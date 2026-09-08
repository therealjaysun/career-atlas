import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  alignment,
  pathQuality,
  DEFAULT_CRITERIA,
  wageAt,
  money,
  matches,
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
for (const o of d.occupations) {
  assert(o.tasks.length > 0 && o.activities.length > 0);
  assert.equal(o.skills.length, 35);
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
  'Verified 923 occupation records; skill alignment, unknown evidence, wage percentiles, outcome thresholds, and PhD underemployment guard.',
);
