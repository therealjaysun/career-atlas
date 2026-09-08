"""Build browser data from O*NET 31.0 CSVs in argv[1]; numpy/scikit-learn/umap required."""
import csv,json,sys
from pathlib import Path
from collections import defaultdict
import numpy as np
from sklearn.feature_extraction.text import TfidfTransformer
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity
from umap import UMAP
source=Path(sys.argv[1])
def rows(name):
 with (source/f'{name}.csv').open(encoding='utf-8-sig') as f: return list(csv.DictReader(f))
occupations={r['O*NET-SOC Code']:r for r in rows('occupation_data')}
tasks,activities=defaultdict(dict),defaultdict(set)
activity_names={}
for r in rows('tasks_to_dwas'):
 code,aid=r['O*NET-SOC Code'],r['DWA Element ID']
 tasks[code][r['Task ID']]=r['Task'];activities[code].add(aid);activity_names[aid]=r['DWA Element Name']
codes,aids=sorted(activities),sorted(activity_names)
aindex={a:i for i,a in enumerate(aids)}
matrix=np.zeros((len(codes),len(aids)))
for i,code in enumerate(codes):
 for aid in activities[code]: matrix[i,aindex[aid]]=1
vectors=TfidfTransformer().fit_transform(matrix)
similarity=cosine_similarity(vectors)
positions=UMAP(n_neighbors=22,min_dist=.22,metric='cosine',random_state=42).fit_transform(vectors)
positions=(positions-positions.min(axis=0))/np.ptp(positions,axis=0)
labels=KMeans(n_clusters=12,n_init=20,random_state=42).fit_predict(vectors)
skill_rows=rows('essential_skills')+rows('transferable_skills')
skill_names={r['Element ID']:r['Element Name'] for r in skill_rows}
sids=sorted(skill_names);ratings=defaultdict(dict)
for r in skill_rows:
 if r['Recommend Suppress']!='Y': ratings[r['O*NET-SOC Code']][(r['Element ID'],r['Scale ID'])]=float(r['Data Value'])
zones={r['O*NET-SOC Code']:int(r['Job Zone']) for r in rows('job_zones')}
clusters=[]
for k in range(12):
 members=np.where(labels==k)[0];centroid=np.asarray(vectors[members].mean(axis=0)).ravel();top=np.argsort(centroid)[-5:][::-1]
 reps=members[np.argsort(similarity[np.ix_(members,members)].mean(axis=1))[-3:][::-1]]
 clusters.append({'id':k,'name':occupations[codes[reps[0]]]['Title'],'count':len(members),'x':round(float(positions[members,0].mean()),4),'y':round(float(positions[members,1].mean()),4),'activities':[activity_names[aids[j]] for j in top],'representatives':[codes[j] for j in reps]})
 print(k,len(members),[occupations[codes[j]]['Title'] for j in reps],flush=True)
data=[]
for i,code in enumerate(codes):
 near=[int(j) for j in np.argsort(similarity[i])[::-1] if j!=i][:8]
 data.append({'id':code,'title':occupations[code]['Title'],'description':occupations[code]['Description'],'x':round(float(positions[i,0]),5),'y':round(float(positions[i,1]),5),'cluster':int(labels[i]),'zone':zones.get(code),'tasks':list(tasks[code].values()),'activities':[aindex[a] for a in sorted(activities[code])],'skills':[ratings[code].get((s,'LV')) for s in sids],'importance':[ratings[code].get((s,'IM')) for s in sids],'neighbors':[[codes[j],round(float(similarity[i,j]),3)] for j in near]})
result={'version':'31.0','source':'https://www.onetcenter.org/database.html','totalOccupations':len(occupations),'excluded':len(occupations)-len(codes),'method':'Binary detailed work activities → IDF weighting → 12 K-means clusters; UMAP projection (cosine, 22 neighbors, min_dist 0.22, seed 42).','skills':[{'id':s,'name':skill_names[s]} for s in sids],'activities':[activity_names[a] for a in aids],'clusters':clusters,'occupations':data}
assert len(data)>800 and len(set(o['id'] for o in data))==len(data)
assert all(len(o['skills'])==len(sids) and o['tasks'] and 0<=o['x']<=1 and 0<=o['y']<=1 for o in data)
out=Path(__file__).resolve().parents[1]/'public'/'onet.json';out.write_text(json.dumps(result,separators=(',',':')))
print(f'Saved {len(data)} occupations, {len(sids)} skills, {len(aids)} activities. {out.stat().st_size} bytes.',flush=True)
