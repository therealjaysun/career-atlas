import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  alignment,
  pathQuality,
  DEFAULT_CRITERIA,
  wageAt,
  money,
  matches,
  searchOccupations,
  backgroundOverlap,
  EMPTY_BACKGROUND,
  aiValue,
  aiLabel,
  compileSkills,
  occupationLayout,
  careerLandscape,
  clusterLabels,
  pickerSuggestions,
  validPrefills,
  PREFILL_FIELDS,
} from '../lib/career.ts';
const d = JSON.parse(
  readFileSync(new URL('../public/onet.json', import.meta.url)),
);
const prefills = JSON.parse(
  readFileSync(new URL('../public/background-options.json', import.meta.url)),
);
assert(validPrefills(prefills));
assert(!validPrefills(null));
assert(
  !validPrefills({
    ...prefills,
    source: { ...prefills.source, items: [{ id: 'bad', name: 42 }] },
  }),
);
assert(
  !validPrefills({
    ...prefills,
    source: {
      ...prefills.source,
      items: [prefills.source.items[0], prefills.source.items[0]],
    },
  }),
);
for (const key of PREFILL_FIELDS) {
  assert(prefills[key].items.length >= 100);
  assert.equal(
    new Set(prefills[key].items.map((item) => item.name.toLowerCase())).size,
    prefills[key].items.length,
  );
}
assert(
  pickerSuggestions(prefills.source.items, 'MIT')[0].name.includes(
    'Massachusetts Institute of Technology',
  ),
);
assert(
  pickerSuggestions(prefills.training.items, 'PMP')
    .slice(0, 5)
    .some((item) => item.name.includes('Project Management Professional')),
);
assert.equal(
  pickerSuggestions(prefills.hobbies.items, 'woodwroking')[0].name,
  'woodworking',
);
const custom = pickerSuggestions(
  [],
  '  My school, north campus  ',
  [],
  true,
)[0];
assert.equal(custom.name, 'My school, north campus');
assert(custom.custom);
assert.equal(
  pickerSuggestions([], 'My school, north campus', [custom], true).length,
  1,
);
assert.equal(
  pickerSuggestions([], 'MY SCHOOL, NORTH CAMPUS', [custom], true).length,
  1,
);
assert.equal(pickerSuggestions([], '   ', [], true).length, 0);
assert.equal(pickerSuggestions([], 'Unlisted', [], false).length, 0);
assert.equal(
  pickerSuggestions([{ id: 'cpp', name: 'C++' }], 'C#', [], true).at(-1).name,
  'C#',
);
const selected = [
  custom,
  prefills.hobbies.items.find((item) => item.name === 'photography'),
];
const stored = selected.map((item) => item.name).join('\n');
assert.deepEqual(stored.split('\n'), [
  'My school, north campus',
  'photography',
]);
assert(
  pickerSuggestions(
    prefills.hobbies.items,
    'photography',
    selected,
    true,
  ).every((item) => item.id !== 'custom:photography'),
);
for (const key of ['source', 'training']) {
  const start = performance.now();
  pickerSuggestions(prefills[key].items, 'certified professional', [], true);
  console.log(
    `${key} suggestions searched in ${(performance.now() - start).toFixed(0)}ms`,
  );
}
const dev = d.occupations.find((o) => o.id === '15-1252.00');
const clerk = d.occupations.find((o) => o.id === '41-2011.00');
const skillMap = occupationLayout(d, 'skills');
assert.equal(occupationLayout(d, 'activities'), d.occupations);
assert.deepEqual(occupationLayout(null, 'skills'), []);
assert.equal(skillMap.length, d.occupations.length);
assert.equal(new Set(skillMap.map((o) => o.id)).size, d.occupations.length);
assert(
  skillMap.filter(
    (o, i) => o.x !== d.occupations[i].x || o.y !== d.occupations[i].y,
  ).length > 900,
);
const skillDev = skillMap.find((o) => o.id === dev.id);
assert.notDeepEqual(skillDev.neighbors, dev.neighbors);
assert.equal(skillDev.skills, dev.skills);
assert.equal(skillDev.wage, dev.wage);
assert.equal(skillDev.ai, dev.ai);
assert.equal(skillDev.trend, dev.trend);
assert(
  d.layouts.skills.clusters[skillDev.cluster].features.includes('Programming'),
);
assert(
  searchOccupations(skillMap, 'software', skillDev.cluster, 0).every(
    (o) => o.cluster === skillDev.cluster,
  ),
);
for (const [basis, map] of [
  ['skills', skillMap],
  ['activities', d.occupations],
]) {
  const clusters = basis === 'skills' ? d.layouts.skills.clusters : d.clusters;
  assert.equal(clusters.length, 12);
  assert.equal(new Set(clusters.map((c) => c.name)).size, 12);
  for (const c of clusters) {
    assert.equal(map.filter((o) => o.cluster === c.id).length, c.count);
    assert(
      c.features.length === 5 &&
        c.representatives.every((id) =>
          map.some((o) => o.id === id && o.cluster === c.id),
        ),
    );
  }
  for (const o of map) {
    assert(o.x >= 0 && o.x <= 1 && o.y >= 0 && o.y <= 1);
    if (basis === 'skills' && o.imputedMeasurements === 70)
      assert.equal(o.neighbors.length, 0);
    else assert.equal(o.neighbors.length, 8);
    assert.equal(
      new Set(o.neighbors.map(([id]) => id)).size,
      o.neighbors.length,
    );
    assert(
      o.neighbors.every(
        ([id, score], i) =>
          id !== o.id &&
          map.some((v) => v.id === id) &&
          score >= -1 &&
          score <= 1 &&
          (!i || score <= o.neighbors[i - 1][1]),
      ),
    );
  }
}
assert.equal(skillMap.filter((o) => o.imputedMeasurements === 70).length, 13);
assert.equal(
  skillMap.reduce((n, o) => n + o.imputedMeasurements, 0),
  d.layouts.skills.imputedValues,
);
// Multiple jobs produce one row per skill, with every source and no inflated levels.
const jobs = [
  { ...dev, skills: [2, null, 4] },
  { ...clerk, skills: [5, 3, 0] },
];
const skillNames = [
  { name: 'Communication' },
  { name: 'Service' },
  { name: 'Writing' },
  { name: 'Planning' },
];
const ratings = { 0: 0, 3: 2.5 };
const combined = compileSkills([...jobs, jobs[0]], ratings, skillNames);
assert.equal(combined.length, 4);
assert.equal(new Set(combined.map((s) => s.id)).size, 4);
const communication = combined.find((s) => s.id === '0');
assert.equal(communication.suggestedLevel, 5);
assert.equal(communication.sources.length, 2);
assert.equal(communication.level, 0); // A user's zero rating wins over job suggestions.
assert.equal(communication.confirmed, true);
assert.equal(combined.find((s) => s.id === '1').confirmed, false);
assert.equal(combined.find((s) => s.id === '3').level, 2.5);
assert.deepEqual(ratings, { 0: 0, 3: 2.5 });
assert.equal(
  compileSkills([jobs[0]], {}, skillNames).find((s) => s.id === '0').level,
  2,
);
assert(!compileSkills([jobs[0]], {}, skillNames).some((s) => s.id === '1'));
assert.deepEqual(
  compileSkills([], ratings, skillNames).map((s) => s.id),
  ['0', '3'],
);
assert.equal(
  compileSkills([{ ...dev, skills: [NaN, null, 0] }], {}, skillNames).length,
  0,
);
const allSuggested = compileSkills([dev, clerk], {}, d.skills);
assert.equal(
  allSuggested.length,
  new Set(
    [dev, clerk].flatMap((o) => o.skills.flatMap((v, i) => (v > 0 ? [i] : []))),
  ).size,
);
assert(allSuggested.every((s) => !s.confirmed && s.level <= 7));
assert.equal(d.occupations.length, 923);
assert.equal(new Set(d.occupations.map((o) => o.id)).size, 923);
assert.equal(wageAt(dev, 2).value, 135980);
assert.equal(wageAt(dev, 4).value, 214670);
assert.equal(wageAt(dev, 6), null);
assert.equal(money({ value: 239200, capped: true }), '$239,200+');
assert.equal(alignment(dev, {}).score, null);
assert.equal(alignment(dev, { 0: 0 }).score, 0);
const full = Object.fromEntries(dev.skills.map((v, i) => [i, v ?? 0]));
assert.equal(alignment(dev, full).score, 100);
assert.equal(alignment(dev, full).coverage, 100);
const base = { ...DEFAULT_CRITERIA, education: 5 };
assert.equal(pathQuality(dev, full, base, 2).status, 'strong');
assert.equal(pathQuality(dev, {}, base, 2).status, 'unknown');

// One source of survivors drives map nodes, links, group labels, and tree candidates.
const qualities = (profile, criteria = base, percentile = 2) =>
  new Map(
    d.occupations.map((o) => [
      o.id,
      pathQuality(o, profile, criteria, percentile),
    ]),
  );
const sourceCoordinates = d.occupations.map(({ id, x, y }) => [id, x, y]);
const outcome = qualities(full);
const before = performance.now();
const focused = careerLandscape(d.occupations, d.clusters, outcome, true);
console.log(
  `Compacted ${focused.occupations.length} career roles in ${(performance.now() - before).toFixed(0)}ms`,
);
// Real title boxes must stay distinct and inside the map at representative zoom levels.
assert.deepEqual(clusterLabels([], 1), []);
for (const clusters of [
  d.clusters,
  d.layouts.skills.clusters,
  focused.clusters,
]) {
  for (const zoom of [0.7, 1, 2, 5]) {
    const labels = clusterLabels(clusters, zoom);
    assert.equal(labels.length, clusters.length);
    for (const [i, label] of labels.entries()) {
      assert(
        label.x >= 0 &&
          label.y >= 0 &&
          label.x + label.width <= 1200 &&
          label.y + label.height <= 800,
      );
      assert.equal(label.lines.join(' '), label.name.replaceAll(' · ', ' '));
      assert(label.lines.every((line) => line.length <= 26));
      for (const other of labels.slice(i + 1))
        assert(
          label.x + label.width <= other.x ||
            other.x + other.width <= label.x ||
            label.y + label.height <= other.y ||
            other.y + other.height <= label.y,
          `Overlapping titles ${label.id}/${other.id} at zoom ${zoom}`,
        );
    }
  }
}
const survivors = new Set(focused.occupations.map((o) => o.id));
assert(survivors.has(dev.id) && !survivors.has(clerk.id));
assert.equal(
  focused.occupations.length,
  d.occupations.filter((o) => outcome.get(o.id).status !== 'below').length,
);
assert(focused.occupations.every((o) => outcome.get(o.id).status !== 'below'));
assert(
  focused.occupations.some(
    (o) => o.x !== d.occupations.find((v) => v.id === o.id).x,
  ),
);
assert.deepEqual(
  focused,
  careerLandscape(d.occupations, d.clusters, outcome, true),
);
for (const c of focused.clusters) {
  assert(c.count > 0);
  assert.equal(
    c.count,
    focused.occupations.filter((o) => o.cluster === c.id).length,
  );
}
for (const o of focused.occupations) {
  const source = d.occupations.find((v) => v.id === o.id);
  assert(Number.isFinite(o.x) && o.x >= 0 && o.x <= 1);
  assert(Number.isFinite(o.y) && o.y >= 0 && o.y <= 1);
  assert.equal(o.cluster, source.cluster);
  assert.equal(o.neighbors, source.neighbors);
  assert.equal(o.wage, source.wage);
  assert.equal(o.ai, source.ai);
}
const restored = careerLandscape(d.occupations, d.clusters, outcome, false);
assert.equal(restored.occupations, d.occupations);
assert.equal(restored.clusters.length, 12);
assert.deepEqual(
  sourceCoordinates,
  d.occupations.map(({ id, x, y }) => [id, x, y]),
);
const one = careerLandscape([dev, clerk], d.clusters, outcome, true);
assert.equal(one.occupations.length, 1);
assert.equal(one.clusters.length, 1);
assert.equal(one.occupations[0].x, 0.5);
assert.equal(one.occupations[0].y, 0.5);
const permissive = {
  education: 0,
  payFloor: 0,
  minFit: 80,
  minGrowth: -100,
  minOpenings: 0,
};
assert.equal(
  careerLandscape(
    d.occupations,
    d.clusters,
    qualities({ 0: 0 }, permissive),
    true,
  ).occupations.length,
  923,
);
assert.equal(
  careerLandscape(
    d.occupations,
    d.clusters,
    qualities({}),
    true,
  ).occupations.some((o) => o.id === dev.id),
  true,
);
assert.deepEqual(careerLandscape([], d.clusters, outcome, true), {
  occupations: [],
  clusters: [],
});
const low = Object.fromEntries(d.skills.map((_, i) => [i, 0]));
assert.equal(
  careerLandscape([dev], d.clusters, qualities(low, permissive), true)
    .occupations.length,
  0,
);
assert.equal(
  careerLandscape([dev], d.clusters, qualities(full, permissive), true)
    .occupations.length,
  1,
);
const highTarget = { ...base, payFloor: 150000 };
assert.equal(
  careerLandscape([dev], d.clusters, qualities(full, highTarget, 2), true)
    .occupations.length,
  0,
);
assert.equal(
  careerLandscape([dev], d.clusters, qualities(full, highTarget, 4), true)
    .occupations.length,
  1,
);
assert.equal(
  careerLandscape(
    [{ ...dev, wage: undefined, trend: undefined }],
    d.clusters,
    new Map([[dev.id, { status: 'unknown' }]]),
    true,
  ).occupations.length,
  1,
);

assert.equal(
  pathQuality(dev, full, { ...base, payFloor: 150000 }, 2).status,
  'below',
);
assert.equal(
  pathQuality(dev, full, { ...base, payFloor: 150000 }, 4).status,
  'strong',
);
assert.equal(
  pathQuality(
    clerk,
    full,
    { ...base, payFloor: 0, minFit: 0, minGrowth: -100, minOpenings: 0 },
    2,
  ).status,
  'below',
);
assert(
  pathQuality(clerk, full, base, 2).reasons.some((r) =>
    r.includes('underemployment'),
  ),
);
assert.equal(
  pathQuality({ ...dev, trend: undefined }, full, base, 2).status,
  'unknown',
);
assert.equal(
  pathQuality(
    {
      ...dev,
      wage: {
        ...dev.wage,
        annual: Array(5).fill({ value: 239200, capped: true }),
      },
    },
    full,
    { ...base, payFloor: 300000 },
    4,
  ).status,
  'unknown',
);
assert(matches(dev, 'software', null, 0));
assert(!matches(dev, 'unfindable phrase', null, 0));
for (const typo of [
  'software enginer',
  'softwrae developer',
  'softwore developer',
]) {
  assert.equal(searchOccupations(d.occupations, typo, null, 0)[0].id, dev.id);
}
assert.equal(
  searchOccupations(d.occupations, 'registered nruse', null, 0)[0].id,
  '29-1141.00',
);
assert.equal(
  searchOccupations(d.occupations, 'unfindable phrase', null, 0).length,
  0,
);
assert(
  searchOccupations(d.occupations, 'RN', null, 0)
    .slice(0, 3)
    .some((o) => o.id === '29-1141.00'),
);
assert.equal(
  searchOccupations(d.occupations, 'software', 5, 0).every(
    (o) => o.cluster === 5,
  ),
  true,
);
assert(
  backgroundOverlap(dev, { ...EMPTY_BACKGROUND, major: 'software' }).includes(
    'software',
  ),
);
assert.deepEqual(
  backgroundOverlap(dev, {
    ...EMPTY_BACKGROUND,
    source: 'Software University',
    physical: 'software',
  }),
  [],
);
assert.equal(
  pathQuality(dev, full, { ...base, education: 6 }, 2).status,
  'strong',
);
assert(
  pathQuality(clerk, full, { ...base, education: 6 }, 2).reasons.some((r) =>
    r.includes('underemployment'),
  ),
);
const demand = { ...dev, abilities: [5] };
assert.equal(
  pathQuality(demand, full, base, 2, { 0: 3 }, [{ name: 'Stamina' }]).status,
  'tradeoff',
);
assert(
  pathQuality(demand, full, base, 2, { 0: 3 }, [
    { name: 'Stamina' },
  ]).cautions[0].includes('Stamina'),
);
assert.equal(
  pathQuality({ ...dev, abilities: [null] }, full, base, 2, { 0: 0 }, [
    { name: 'Stamina' },
  ]).status,
  'unknown',
);
assert.equal(aiValue(dev, 'observed'), 0.288);
assert.equal(aiValue({ ...dev, ai: undefined }, 'observed'), null);
assert.equal(
  aiValue({ ...dev, ai: { ...dev.ai, observed: 0 } }, 'observed'),
  0,
);
assert.equal(
  aiValue({ ...dev, ai: { ...dev.ai, observed: NaN } }, 'observed'),
  null,
);
assert.equal(
  aiLabel({ ...dev, ai: undefined }, 'observed'),
  'AI data unavailable',
);
assert.equal(dev.ai.usage.collaboration_bucket_automation_pct, 60.79);
assert.equal(
  d.occupations.filter((o) => aiValue(o, 'observed') !== null).length,
  876,
);
assert.equal(
  d.occupations.filter((o) => aiValue(o, 'applicability') !== null).length,
  893,
);
assert.equal(d.occupations.filter((o) => o.ai.usage !== null).length, 718);
for (const o of d.occupations) {
  assert(o.tasks.length > 0 && o.activities.length > 0);
  assert.equal(o.skills.length, 35);
  assert.equal(o.abilities.length, 52);
  assert(o.abilities.every((v) => v === null || (v >= 0 && v <= 7)));
  assert.equal(o.ai.soc, o.id.split('.')[0]);
  for (const metric of ['observed', 'applicability'])
    assert(o.ai[metric] === null || (o.ai[metric] >= 0 && o.ai[metric] <= 1));
  if (o.ai.usage)
    for (const metric of [
      'pct',
      'collaboration_bucket_automation_pct',
      'collaboration_bucket_augmentation_pct',
    ]) {
      const v = o.ai.usage[metric];
      assert(v === undefined || (v >= 0 && v <= 100));
    }
  assert(o.x >= 0 && o.x <= 1 && o.y >= 0 && o.y <= 1);
  assert(o.trend?.growth !== null && o.trend?.openings >= 0);
  for (const unit of ['annual', 'hourly']) {
    const points = o.wage[unit].filter(Boolean);
    assert(
      points.every(
        (p, i) => p.value > 0 && (!i || p.value >= points[i - 1].value),
      ),
    );
  }
}
console.log(
  'Verified 923 records, fuzzy title ranking, profile/ability rules, AI joins and missing-vs-zero data, wage scenarios, and PhD underemployment guard.',
);
