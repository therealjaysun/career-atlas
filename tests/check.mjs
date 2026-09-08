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
} from '../lib/career.ts';
const d = JSON.parse(
  readFileSync(new URL('../public/onet.json', import.meta.url)),
);
const dev = d.occupations.find((o) => o.id === '15-1252.00');
const clerk = d.occupations.find((o) => o.id === '41-2011.00');
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
