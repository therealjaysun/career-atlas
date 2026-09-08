"""Attach BLS national projections from official O*NET OnLine trend pages."""
import concurrent.futures,html,json,re,time,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1];cache=Path('/tmp/onet-trends');cache.mkdir(exist_ok=True)
data=json.loads((root/'public/onet.json').read_text())
def fetch(o):
 code=o['id'];p=cache/f'{code}.html';url=f'https://www.onetonline.org/link/localtrends/{code}'
 try:
  if not p.exists():
   with urllib.request.urlopen(url,timeout=25) as r:text=r.read().decode('utf-8')
   p.write_text(text);time.sleep(.12)
  else:text=p.read_text()
  pairs=re.findall(r'<dt[^>]*>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>',text,re.S)
  clean=lambda s:html.unescape(re.sub('<[^>]+>',' ',s)).strip()
  values={re.sub(r'\s+',' ',clean(k)):re.sub(r'\s+',' ',clean(v)) for k,v in pairs}
  def number(prefix):
   value=next((v for k,v in values.items() if k.startswith(prefix)),None)
   m=re.search(r'-?[\d,]+(?:\.\d+)?',value or '')
   return float(m.group().replace(',','')) if m else None
  years=re.search(r'(20\d\d)-(20\d\d) employment projections',text)
  group=re.search(r'(?:Employment|Trend) data (?:collected from|for) <b>(.*?)</b>',text)
  return {'employment':number('Employment'),'growth':number('Projected growth'),'openings':number('Projected annual'),'start':int(years[1]) if years else None,'end':int(years[2]) if years else None,'group':clean(group[1]) if group else None,'source':url}
 except Exception as e:return {'employment':None,'growth':None,'openings':None,'source':url,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,t in enumerate(pool.map(fetch,data['occupations'])):
  data['occupations'][i]['trend']=t
  if (i+1)%100==0:print(f'{i+1} outlook records',flush=True)
(root/'public/onet.json').write_text(json.dumps(data,separators=(',',':')))
print('Outlook available:',sum(o['trend']['growth'] is not None for o in data['occupations']),flush=True)
print('Errors:',[o['id'] for o in data['occupations'] if o['trend'].get('error')],flush=True)
