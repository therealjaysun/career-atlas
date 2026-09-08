"""Cache official O*NET national wage pages (BLS OEWS) and attach percentiles.
Run after prepare_data.py. Public pages contain chart JSON with censoring flags.
"""
import concurrent.futures,datetime,html,json,re,time,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
cache=Path('/tmp/onet-wages');cache.mkdir(exist_ok=True)
data=json.loads((root/'public/onet.json').read_text())
def fetch(o):
 code=o['id'];p=cache/f'{code}.html';url=f'https://www.onetonline.org/link/localwages/{code}'
 try:
  if not p.exists():
   with urllib.request.urlopen(url,timeout=25) as r: text=r.read().decode('utf-8')
   p.write_text(text);time.sleep(.12)
  else:text=p.read_text()
  year=re.search(r'(20\d\d) wage data',text)
  group=re.search(r'Wage data collected from <b>(.*?)</b>',text)
  charts=[json.loads(s) for s in re.findall(r'createWagesChart\((\{[^\n]+\})\);',text)]
  annual=next((c for c in charts if c.get('chartMode')=='annual'),None)
  hourly=next((c for c in charts if c.get('chartMode')=='hourly'),None)
  def values(c):
   if not c:return [None]*5
   points={int(x['percent']):x for x in c['dataNational']}
   result=[]
   for percentile in [10,25,50,75,90]:
    x=points.get(percentile,{})
    try:v=float(x['x'])
    except (KeyError,ValueError,TypeError):v=None
    result.append({'value':v,'capped':bool(x.get('maxValue'))} if v is not None and v>0 else None)
   return result
  return code,{'year':int(year.group(1)) if year else None,'source':url,'annual':values(annual),'hourly':values(hourly),'soc':code.split('.')[0],'group':html.unescape(group.group(1)) if group else None}
 except Exception as e:return code,{'error':str(e),'source':url,'annual':[None]*5,'hourly':[None]*5,'year':None,'soc':code.split('.')[0]}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,(code,wage) in enumerate(pool.map(fetch,data['occupations'])):
  data['occupations'][i]['wage']=wage
  if (i+1)%100==0:print(f'{i+1}/{len(data["occupations"])} wage records',flush=True)
assert all(o['id'].split('.')[0]==o['wage']['soc'] for o in data['occupations'])
errors=[o['id'] for o in data['occupations'] if 'error' in o['wage']]
print('Errors:',errors,flush=True)
data['wageRetrieved']=datetime.date.today().isoformat()
data['wageSource']='BLS OEWS, national estimates, retrieved through O*NET OnLine.'
(root/'public/onet.json').write_text(json.dumps(data,separators=(',',':')))
print('Annual data:',sum(any(o['wage']['annual']) for o in data['occupations']), 'years:',sorted(set(o['wage']['year'] for o in data['occupations'] if o['wage']['year'])),flush=True)
