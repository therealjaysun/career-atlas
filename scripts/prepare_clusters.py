"""Add a reproducible skills layout without replacing occupational or wage data.

Run after prepare_enrichment.py. Requires the same numpy, sklearn, and umap
environment as prepare_data.py. Clustering never uses titles, industry or SOC.
"""
import json
from pathlib import Path
import numpy as np
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
from umap import UMAP

target = Path(__file__).resolve().parents[1] / 'public' / 'onet.json'
data = json.loads(target.read_text())
occupations = data['occupations']

# Activity labels describe the observed tasks, not an industry classification.
activity_names = [
    'Maintain vehicles · Record travel',
    'Test systems · Plan work',
    'Adjust · Repair equipment',
    'Document · Verify transactions',
    'Monitor learning · Plan lessons',
    'Record histories · Plan treatment',
    'Research · Report findings',
    'Load materials · Maintain equipment',
    'Sell · Explain products',
    'Teach · Guide discussions',
    'Clean facilities · Review specifications',
    'Train staff · Plan operations',
]
for cluster in data['clusters']:
    cluster['name'] = activity_names[cluster['id']]
    cluster['features'] = cluster['activities']

# Equalize feature scales; median filling is only for the map, never user fit.
raw = np.array([(o['skills'] + o['importance']) for o in occupations], dtype=float)
imputed = int(np.isnan(raw).sum())
vectors = StandardScaler().fit_transform(SimpleImputer(strategy='median').fit_transform(raw))
labels = KMeans(n_clusters=12, n_init=20, random_state=42).fit_predict(vectors)
positions = UMAP(n_neighbors=22, min_dist=.22, metric='euclidean', random_state=42).fit_transform(vectors)
positions = (positions - positions.min(axis=0)) / np.ptp(positions, axis=0)
similarities = cosine_similarity(vectors)
clusters = []
skill_count = len(data['skills'])
for k in range(12):
    members = np.where(labels == k)[0]
    centroid = vectors[members].mean(axis=0)
    # Label by skill dimensions with the largest relative demand in this group.
    contrast = (centroid[:skill_count] + centroid[skill_count:]) / 2
    foundational = contrast.max() <= 0
    top = np.argsort(np.nanmean(raw[members, :skill_count], axis=0) if foundational else contrast)[::-1][:5]
    features = [data['skills'][i]['name'] for i in top]
    name = f'Foundational · {features[0]}' if foundational else ' · '.join(features[:2])
    if any(c['name'] == name for c in clusters):
        name = f'{features[0]} · {features[2]}'
    cluster_mean = np.asarray([np.nanmean(raw[members, i]) for i in top])
    representatives = members[np.argsort(np.linalg.norm(vectors[members] - centroid, axis=1))[:3]]
    clusters.append({
        'id': k, 'name': name, 'count': len(members),
        'x': round(float(positions[members, 0].mean()), 5),
        'y': round(float(positions[members, 1].mean()), 5),
        'features': features,
        'featureBasis': 'reported-level' if foundational else 'relative-demand',
        'representatives': [occupations[i]['id'] for i in representatives],
        'meanLevels': [round(float(v), 2) for v in cluster_mean],
    })
    print(k, len(members), features[:3], flush=True)

layout = {}
for i, occupation in enumerate(occupations):
    neighbors = [j for j in np.argsort(-similarities[i], kind='stable')
                 if j != i and not np.isnan(raw[j]).all()][:8] if not np.isnan(raw[i]).all() else []
    layout[occupation['id']] = {
        'x': round(float(positions[i, 0]), 5), 'y': round(float(positions[i, 1]), 5),
        'cluster': int(labels[i]),
        'imputedMeasurements': int(np.isnan(raw[i]).sum()),
        'neighbors': [[occupations[j]['id'], round(float(similarities[i, j]), 4)] for j in neighbors],
    }
data['layouts'] = {'skills': {
    'method': '35 skill levels and 35 importance ratings; median imputation for mapping only; feature standardization; K-means (12 clusters, 20 starts, seed 42); UMAP (Euclidean, 22 neighbors, min_dist 0.22, seed 42). Connections use cosine similarity of the standardized 70-feature profiles.',
    'dimensions': vectors.shape[1], 'imputedValues': imputed,
    'clusters': clusters, 'occupations': layout,
}}
assert set(layout) == {o['id'] for o in occupations}
assert sum(c['count'] for c in clusters) == len(occupations)
assert len({c['name'] for c in clusters}) == 12
assert all(0 <= p['x'] <= 1 and 0 <= p['y'] <= 1 for p in layout.values())
target.write_text(json.dumps(data, separators=(',', ':')))
print(f'Saved {len(layout)} skills positions; {imputed} missing measurements filled for mapping only.', flush=True)
