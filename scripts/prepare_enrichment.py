"""Attach O*NET titles/abilities and published AI measures to the existing map.

Usage: python3 scripts/prepare_enrichment.py /tmp/onet-enrichment
Raw input sources and retrieval date are recorded in README.md. Never fuzzy-join
AI data: only exact 2018 SOC groups are inherited by their O*NET specializations.
"""
import csv
import json
import sys
import io
import urllib.request
from collections import defaultdict
from pathlib import Path

source = Path(sys.argv[1])
source.mkdir(parents=True, exist_ok=True)
# Pin research snapshots so the overlay and the tests remain reproducible.
hf = 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/2ea58ff75e4247d26810c37f10c179edc2466cac'
ms = 'https://raw.githubusercontent.com/microsoft/working-with-ai/c94a07c52fb1d88ca5d221388f06d10e1bd6d2fe'
onet = 'https://www.onetcenter.org/dl_files/database/db_31_0_csv'
for name, url in {
    'job_titles.csv': f'{onet}/job_titles.csv',
    'abilities.csv': f'{onet}/abilities.csv',
    'job_exposure.csv': f'{hf}/labor_market_impacts/job_exposure.csv',
    'ai_applicability_scores.csv': f'{ms}/ai_applicability_scores.csv',
}.items():
    if not (source / name).exists():
        with urllib.request.urlopen(url, timeout=120) as response:
            content = response.read()
        (source / name).write_bytes(content)

usage_file = source / 'aei-may-2026.json'
if not usage_file.exists():
    url = f'{hf}/release_2026_06_26/data/aei_claude_ai_2026-06-26.csv'
    with urllib.request.urlopen(url, timeout=180) as response:
        usage_rows = [r for r in csv.DictReader(io.TextIOWrapper(response, encoding='utf-8'))
                      if r['geo_id'] == 'GLOBAL' and r['category_name'] == 'soc_occupation'
                      and r['hierarchy_level'] == '0' and r['date_start'] == '2026-05-01'
                      and r['metric_id'] in ['pct', 'collaboration_bucket_automation_pct',
                                            'collaboration_bucket_augmentation_pct']]
    assert usage_rows, 'No May 2026 occupation rows found'
    usage_file.write_text(json.dumps(usage_rows))
target = Path(__file__).resolve().parents[1] / 'public' / 'onet.json'
data = json.loads(target.read_text())


def rows(name):
    with (source / name).open(encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


aliases = defaultdict(set)
for r in rows('job_titles.csv'):
    for field in ['Job Title', 'Short Title']:
        if r[field]:
            aliases[r['O*NET-SOC Code']].add(r[field])
ability_rows = rows('abilities.csv')
ability_names = {r['Element ID']: r['Element Name'] for r in ability_rows}
ability_ids = sorted(ability_names)
levels = defaultdict(dict)
for r in ability_rows:
    if r['Scale ID'] == 'LV' and r['Recommend Suppress'] != 'Y':
        levels[r['O*NET-SOC Code']][r['Element ID']] = float(r['Data Value'])
data['abilities'] = [{'id': a, 'name': ability_names[a]} for a in ability_ids]

anthropic = {r['occ_code']: r for r in rows('job_exposure.csv')}
microsoft = {r['SOC Code']: r for r in rows('ai_applicability_scores.csv')}
usage = defaultdict(dict)
for r in json.loads((source / 'aei-may-2026.json').read_text()):
    assert r['geo_id'] == 'GLOBAL' and r['date_start'] == '2026-05-01'
    assert r['category_name'] == 'soc_occupation' and r['hierarchy_level'] == '0'
    assert r['metric_id'] not in usage[r['node_external_id']], 'Duplicate usage metric'
    usage[r['node_external_id']][r['metric_id']] = float(r['value'])
    usage[r['node_external_id']]['title'] = r['node_name']
for o in data['occupations']:
    code = o['id'].split('.')[0]
    o['aliases'] = sorted(aliases[o['id']] - {o['title']})
    o['abilities'] = [levels[o['id']].get(a) for a in ability_ids]
    a, m, u = anthropic.get(code), microsoft.get(code), usage.get(o['id'], {})
    o['ai'] = {
        'soc': code,
        'observed': float(a['observed_exposure']) if a else None,
        'observedTitle': a['title'] if a else None,
        'applicability': float(m['ai_applicability_score']) if m else None,
        'applicabilityTitle': m['title'] if m else None,
        'usage': u or None,
    }
    for metric in ['observed', 'applicability']:
        assert o['ai'][metric] is None or 0 <= o['ai'][metric] <= 1
data['aiRetrieved'] = '2026-09-08'
assert sum(o['ai']['observed'] is not None for o in data['occupations']) == 876
assert sum(o['ai']['usage'] is not None for o in data['occupations']) == 718
target.write_text(json.dumps(data, separators=(',', ':')))
print({
    'occupations': len(data['occupations']),
    'aliases': sum(len(o['aliases']) for o in data['occupations']),
    'abilities': len(ability_ids),
    **{key: sum(o['ai'][key] is not None for o in data['occupations'])
       for key in ['observed', 'applicability', 'usage']},
    'bytes': target.stat().st_size,
})
