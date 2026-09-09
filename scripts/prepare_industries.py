"""Attach O*NET OnLine's published industry memberships; no title-based inference."""
import csv
import html
import io
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

root = Path(__file__).resolve().parents[1]
cache = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/onet-industries')
cache.mkdir(parents=True, exist_ok=True)
base = 'https://www.onetonline.org/find/industry'


def fetch(name, url):
    path = cache / name
    if not path.exists():
        with urlopen(url, timeout=40) as response:
            content = response.read().decode('utf-8-sig')
        path.write_text(content)
        time.sleep(0.2)
    return path.read_text()


index = fetch('index.html', base)
industries = [
    {'id': code, 'name': html.unescape(name), 'source': f'{base}?i={code}&g=Go'}
    for code, name in re.findall(r'<option value="(\d+)">([^<]+)</option>', index)
    if code != '0'
]
assert len(industries) == 20, 'Review the upstream industry catalog before importing'


def members(industry):
    url = f"{base}/{quote(industry['name'], safe='')}.csv?i={industry['id']}&fmt=csv"
    rows = list(csv.DictReader(io.StringIO(fetch(f"{industry['id']}.csv", url))))
    assert rows, f"No occupations for {industry['name']}"
    codes = set()
    for row in rows:
        code = row['Code']
        # Grouped rows without an O*NET code cannot be joined to an exact occupation.
        if not code:
            continue
        assert re.fullmatch(r'\d{2}-\d{4}\.\d{2}', code), code
        share = float(row['Employed by this Industry'].rstrip('%'))
        assert 0 < share <= 100, row
        codes.add(code)
    return industry['id'], codes


with ThreadPoolExecutor(max_workers=4) as pool:
    memberships = dict(pool.map(members, industries))
data_path = root / 'public/onet.json'
data = json.loads(data_path.read_text())
for occupation in data['occupations']:
    occupation['industries'] = [
        code for code, members in memberships.items() if occupation['id'] in members
    ]
data['industries'] = industries
data['industryRetrieved'] = date.fromtimestamp(max((cache / f"{i['id']}.csv").stat().st_mtime for i in industries)).isoformat()
# All requests and validations succeed before replacing the dataset.
temporary = data_path.with_suffix('.tmp')
temporary.write_text(json.dumps(data, separators=(',', ':')))
temporary.replace(data_path)
print(f"Mapped {sum(bool(o['industries']) for o in data['occupations'])} occupations across {len(industries)} industries.")
