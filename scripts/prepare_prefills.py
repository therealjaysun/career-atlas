"""Build local profile suggestions from public source snapshots; never execute the SQL export."""
import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

CACHE = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/onet-prefill')
CACHE.mkdir(parents=True, exist_ok=True)
FILES = {
    'schools2024.zip': 'https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip',
    'certifications.zip': 'https://cloudfront.careeronestop.org/TridionMultimedia/tcm24-64713_Zip_COS_Cert.zip',
    'hobbies.html': 'https://www.wikidata.org/wiki/Wikidata:List_of_activities_done_as_hobby',
}
for name, url in FILES.items():
    target = CACHE / name
    if not target.exists():
        with urlopen(Request(url, headers={'User-Agent': 'CareerAtlas/1.0 public dataset research'}), timeout=40) as response:
            body = response.read()
        assert body, f'Empty source: {url}'
        target.write_bytes(body)


def sql_rows(text, table):
    # Read literal fields, respecting doubled quotes and function parentheses. SQL is data only.
    pattern = re.compile(r'Insert into ' + re.escape(table) + r'\s*\(([^)]+)\)\s*Values\s*\(', re.I)
    for match in pattern.finditer(text):
        columns = [s.strip() for s in match[1].split(',')]
        values, start, index, depth, quoted = [], match.end(), match.end(), 1, False
        while index < len(text):
            char = text[index]
            if char == "'":
                if quoted and index + 1 < len(text) and text[index + 1] == "'":
                    index += 2
                    continue
                quoted = not quoted
            elif not quoted:
                if char == '(':
                    depth += 1
                elif char == ')':
                    depth -= 1
                if (char == ',' and depth == 1) or depth == 0:
                    value = text[start:index].strip()
                    values.append(value[1:-1].replace("''", "'") if value.startswith("'") and value.endswith("'") else value)
                    start = index + 1
                    if depth == 0:
                        break
            index += 1
        assert depth == 0 and len(columns) == len(values), f'Invalid export row for {table}'
        yield dict(zip(columns, values))


class Hobbies(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items, self.item, self.label = [], None, False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'tr':
            match = re.search(r'\bwd_q(\d+)\b', attrs.get('class', ''))
            self.item = {'id': 'wikidata:Q' + match[1], 'name': ''} if match else None
        if tag == 'td':
            self.label = attrs.get('class') == 'wd_label'

    def handle_data(self, data):
        if self.label and self.item is not None:
            self.item['name'] += data

    def handle_endtag(self, tag):
        if tag == 'td':
            self.label = False
        if tag == 'tr' and self.item:
            self.item['name'] = self.item['name'].strip()
            if self.item['name']:
                self.items.append(self.item)
            self.item = None


def unique(items):
    result = {}
    for item in items:
        item['name'] = ' '.join(item['name'].split())
        assert item['id'] and 0 < len(item['name']) <= 500
        key = item['name'].casefold()
        if key not in result:
            result[key] = item
    return sorted(result.values(), key=lambda item: item['name'].casefold())


with zipfile.ZipFile(CACHE / 'schools2024.zip') as archive:
    schools = list(csv.DictReader(io.StringIO(archive.read('HD2024.csv').decode('utf-8-sig'))))
school_items = unique([{
    'id': 'ipeds:' + row['UNITID'],
    'name': f"{row['INSTNM']} — {row['CITY']}, {row['STABBR']}",
    'aliases': [row['INSTNM'], *filter(None, re.split(r'[|;,]', row['IALIAS'].strip()))],
} for row in schools])
with zipfile.ZipFile(CACHE / 'certifications.zip') as archive:
    readme = archive.read('readme-certifications.txt').decode('utf-8-sig')
    assert 'July 2026' in readme, 'Review the certification snapshot date before updating'
    organizations = {r['ORG_ID']: r for r in sql_rows(archive.read('1-CERT_ORGS.sql').decode('utf-8-sig'), 'CERT_ORGS')}
    certifications = list(sql_rows(archive.read('2-CERTIFICATIONS.sql').decode('utf-8-sig'), 'CERTIFICATIONS'))
cert_items = []
for row in certifications:
    org = organizations.get(row['ORG_ID'])
    if not org or any(r.get(flag, '0') == '1' for r in [row, org] for flag in ['DELETED', 'SUPPRESS']):
        continue
    aliases = [row.get('ACRONYM', ''), org.get('ACRONYM', ''), row['CERT_NAME'], org['ORG_NAME']]
    cert_items.append({
        'id': 'cos:' + row['CERT_ID'],
        'name': row['CERT_NAME'] + ' — ' + org['ORG_NAME'],
        'aliases': [value for value in aliases if value and value != 'NULL'],
    })
cert_items = unique(cert_items)
hobbies = Hobbies()
hobbies.feed((CACHE / 'hobbies.html').read_text())
hobby_items = unique(hobbies.items)
assert len(school_items) > 5000 and len(cert_items) > 4000 and len(hobby_items) > 100
for items in [school_items, cert_items, hobby_items]:
    assert len({item['id'] for item in items}) == len(items)
assert any('Harvard University' in item['name'] for item in school_items)
assert any('Project Management Professional' in item['name'] for item in cert_items)
assert any(item['name'].lower() == 'photography' for item in hobby_items)
# A runnable parser check covers punctuation and embedded function arguments in the source export.
assert list(sql_rows("Insert into TEST (ID, NAME, DATE) Values ('1', 'Cook, chef''s helper', TO_DATE('1/1/2026', 'MM/DD/YYYY'));", 'TEST'))[0]['NAME'] == "Cook, chef's helper"
result = {
    'retrieved': str(date.today()),
    'source': {'label': 'NCES IPEDS', 'snapshot': '2024 · U.S. colleges and training providers', 'url': 'https://nces.ed.gov/ipeds/use-the-data', 'items': school_items},
    'training': {'label': 'CareerOneStop', 'snapshot': 'July 2026 · national certifications', 'url': 'https://www.careeronestop.org/Developers/Data/certifications.aspx', 'items': cert_items},
    'hobbies': {'label': 'Wikidata', 'snapshot': str(date.today()) + ' · community hobby list', 'url': FILES['hobbies.html'], 'items': hobby_items},
    'inputs': {name: {'url': url, 'sha256': hashlib.sha256((CACHE / name).read_bytes()).hexdigest()} for name, url in FILES.items()},
}
Path('public/background-options.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
for key in ['source', 'hobbies', 'training']:
    print(key, len(result[key]['items']))
print('Hobbies:', ', '.join(item['name'] for item in hobby_items))
