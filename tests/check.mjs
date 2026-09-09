import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { observeViewport } from '../lib/viewport.ts';
import {
  intensityField,
  fieldColor,
  fieldQuartiles,
  iqrColorValue,
} from '../lib/intensity-field.ts';
import {
  workStyles,
  matchesWorkStyle,
  workStyleColor,
  workStyleLandscape,
} from '../lib/work-style.ts';
import {
  alignment,
  pathQuality,
  DEFAULT_CRITERIA,
  wageAt,
  money,
  searchOccupations,
  filterDatabase,
  titleScore,
  EMPTY_BACKGROUND,
  aiValue,
  aiLabel,
  compileSkills,
  occupationLayout,
  careerLandscape,
  possibilityTree,
  clusterLabels,
  cloud3D,
  mappable3D,
  depthDimension,
  rotateCamera,
  INITIAL_CAMERA,
  mapPoint,
  pickerSuggestions,
  validPrefills,
  PREFILL_FIELDS,
} from '../lib/career.ts';
import {
  connectBackground,
  connectionStrength,
  schoolPrograms,
  schoolMajorEvidence,
} from '../lib/background.ts';
const d = JSON.parse(
  readFileSync(new URL('../public/onet.json', import.meta.url)),
);
// Work-style filtering and splitting retain real subclusters, missingness, and source data.
{
  const styles = workStyles(d);
  assert.equal(styles.size, 923);
  const known = [...styles.values()].filter((s) => s.balance !== null);
  assert.equal(known.length, 905);
  assert(known.every((s) => s.balance >= 0 && s.balance <= 100));
  assert(styles.get('47-2061.00').balance > styles.get('15-1252.00').balance);
  assert(
    styles.get('29-1141.00').physical > 0 &&
      styles.get('29-1141.00').knowledge > 0,
  );
  assert.deepEqual(workStyles(null), new Map());
  assert.deepEqual(
    workStyles({ ...d, occupations: [...d.occupations].reverse() }),
    styles,
  );
  const missing = [...styles.values()].find((s) => s.balance === null);
  assert(matchesWorkStyle(missing, 'all', 50));
  for (const direction of ['knowledge', 'physical']) {
    assert(!matchesWorkStyle(missing, direction, 50));
    for (const invalid of [NaN, Infinity, -1, 101])
      assert(!matchesWorkStyle(known[0], direction, invalid));
  }
  for (const threshold of [0, 25, 50, 75, 100]) {
    for (const s of known) {
      const physical = matchesWorkStyle(s, 'physical', threshold);
      const knowledge = matchesWorkStyle(s, 'knowledge', threshold);
      assert(physical || knowledge);
      assert.equal(physical && knowledge, s.balance === threshold);
    }
  }
  // Real zero is measured; below 80% coverage is unknown. Ties and a singleton have midpoint ranks.
  const abilities = ['1.A.3.', '1.A.2.', '1.A.1.'].flatMap((prefix) =>
    Array.from({ length: 5 }, (_, i) => ({ id: prefix + i })),
  );
  const zero = { id: 'zero', abilities: Array(15).fill(0) };
  const covered = { id: 'covered', abilities: [null, ...Array(14).fill(0)] };
  const sparse = {
    id: 'sparse',
    abilities: [null, null, ...Array(13).fill(0)],
  };
  const sample = workStyles({
    abilities,
    occupations: [zero, covered, sparse],
  });
  assert.equal(sample.get('zero').balance, 50);
  assert.equal(sample.get('covered').balance, 50);
  assert.equal(sample.get('sparse').balance, null);
  assert.equal(
    workStyles({ abilities, occupations: [zero] }).get('zero').balance,
    50,
  );
  assert.equal(workStyleColor(null), workStyleColor(NaN));
  assert.notEqual(workStyleColor(0), workStyleColor(100));
  for (const basis of ['skills', 'activities']) {
    const source = occupationLayout(d, basis);
    const groups = basis === 'skills' ? d.layouts.skills.clusters : d.clusters;
    const original = JSON.stringify(source);
    const filtered = filterDatabase(
      source,
      { industries: ['31'], minPay: 80000, maxPay: 180000 },
      2,
      'annual',
    ).filter((o) => matchesWorkStyle(styles.get(o.id), 'knowledge', 40));
    assert(filtered.length > 0 && filtered.length < source.length);
    for (const roles of [source, filtered, source.slice(0, 1), []]) {
      const split = workStyleLandscape(roles, groups, styles, 0.25);
      assert.deepEqual(split, workStyleLandscape(roles, groups, styles, 0.25));
      assert.deepEqual(
        split.occupations.map((o) => o.id),
        roles.map((o) => o.id),
      );
      assert.equal(
        split.clusters.reduce((sum, c) => sum + c.count, 0) +
          split.unknownCount,
        roles.length,
      );
      assert.equal(
        new Set(split.clusters.map((c) => c.labelKey)).size,
        split.clusters.length,
      );
      for (const [i, o] of split.occupations.entries()) {
        assert.equal(o.cluster, roles[i].cluster);
        assert.equal(o.neighbors, roles[i].neighbors);
        assert.equal(o.abilities, roles[i].abilities);
        assert(o.x >= 0 && o.x <= 1 && o.y >= 0 && o.y <= 1);
        const score = styles.get(o.id).balance;
        if (score === null) assert.equal(o.y, 0.93);
        else {
          const b = split.bounds[score >= 50 ? 'physical' : 'knowledge'];
          assert(o.x >= b.left && o.x <= b.right);
        }
      }
      for (const zoom of [0.7, 1, 5]) {
        const labels = clusterLabels(split.clusters, zoom, 1500, 900);
        if (roles.length) assert(labels.length > 0);
        for (const label of labels) {
          const bounds = split.clusters.find(
            (c) => c.labelKey === label.key,
          ).labelBounds;
          assert(
            label.x >= mapPoint({ x: bounds.left, y: 0 }, 1500, 900).x - 1e-9,
          );
          assert(
            label.x + label.width <=
              mapPoint({ x: bounds.right, y: 0 }, 1500, 900).x + 1e-9,
          );
          assert(Math.abs(label.scale * zoom - 1) < 1e-10);
        }
      }
    }
    assert.equal(JSON.stringify(source), original);
  }
}
// The third dimension preserves membership while adding real, rotatable depth.
{
  const work = workStyles(d);
  const before = JSON.stringify(d);
  const dimensions = ['work', 'pay', 'ai'].map((axis) =>
    depthDimension(d.occupations, work, axis, 2, 'annual', 'observed'),
  );
  for (const dimension of dimensions) {
    assert.equal(dimension.values.size, d.occupations.length);
    assert(
      [...dimension.values.values()].every(
        (v) => v === null || (v >= 0 && v <= 1),
      ),
    );
    for (const basis of ['skills', 'activities']) {
      const roles = occupationLayout(d, basis);
      const groups =
        basis === 'skills' ? d.layouts.skills.clusters : d.clusters;
      for (const camera of [
        INITIAL_CAMERA,
        rotateCamera(INITIAL_CAMERA, 600, 600),
        rotateCamera(INITIAL_CAMERA, -900, -900),
      ]) {
        for (const [width, height, inset] of [
          [1500, 900, 360],
          [900, 600, 360],
          [360, 600, 0],
        ]) {
          const scene = cloud3D(
            roles,
            groups,
            dimension.values,
            camera,
            width,
            height,
            inset,
          );
          const mapped = roles.filter(
            (o) =>
              !o.imputedMeasurements && dimension.values.get(o.id) !== null,
          );
          assert.deepEqual(
            scene.occupations.map((o) => o.id),
            mapped.map((o) => o.id),
          );
          assert.equal(scene.edges.length, 12);
          assert.equal(
            scene.clusters.reduce((sum, c) => sum + c.count, 0),
            mapped.length,
          );
          assert.equal(scene.excludedCount, roles.length - mapped.length);
          for (const [i, o] of scene.occupations.entries()) {
            assert.equal(o.cluster, mapped[i].cluster);
            assert.equal(o.neighbors, mapped[i].neighbors);
            const point = mapPoint(o, width, height);
            assert(Number.isFinite(point.x) && Number.isFinite(point.y));
            assert(
              point.x >= 0 &&
                point.x <= width &&
                point.y >= 0 &&
                point.y <= height,
            );
            assert(scene.points.get(o.id).scale > 0);
          }
          // Filtering a measured role set cannot shift its coordinate or depth scale.
          const subset = mapped.slice(0, 10);
          const filtered = cloud3D(
            subset,
            groups,
            dimension.values,
            camera,
            width,
            height,
            inset,
          );
          for (const o of subset)
            assert.deepEqual(filtered.points.get(o.id), scene.points.get(o.id));
          for (const zoom of [0.7, 1, 5]) {
            const labels = clusterLabels(scene.clusters, zoom, width, height);
            assert(labels.length > 0);
            assert(
              labels.every((label) => Math.abs(label.scale * zoom - 1) < 1e-10),
            );
          }
        }
      }
    }
  }
  const empty = cloud3D([], [], new Map(), INITIAL_CAMERA, 1200, 800);
  assert.deepEqual(empty.occupations, []);
  assert.deepEqual(empty.clusters, []);
  assert.equal(empty.excludedCount, 0);
  // Identical X/Y with different Z must have distinct depth and projected positions.
  const a = empty.project({ x: 0.6, y: 0.6, z: 0 });
  const b = empty.project({ x: 0.6, y: 0.6, z: 1 });
  assert.notEqual(a.depth, b.depth);
  assert.notEqual(a.x, b.x);
  assert.notEqual(a.scale, b.scale);
  const rotated = cloud3D(
    [],
    [],
    new Map(),
    rotateCamera(INITIAL_CAMERA, 50, 20),
    1200,
    800,
  );
  assert.notDeepEqual(rotated.project({ x: 0.6, y: 0.6, z: 1 }), b);
  assert.equal(rotateCamera(INITIAL_CAMERA, 0, 10000).pitch, 1.2);
  assert.equal(rotateCamera(INITIAL_CAMERA, 0, -10000).pitch, -1.2);
  const fake = [
    {
      id: 'zero',
      ai: { observed: 0 },
      wage: { annual: [null, null, { value: 0, capped: false }] },
    },
    {
      id: 'capped',
      wage: { annual: [null, null, { value: 240000, capped: true }] },
    },
    { id: 'missing' },
  ];
  const pay = depthDimension(fake, new Map(), 'pay', 2, 'annual', 'observed');
  const ai = depthDimension(fake, new Map(), 'ai', 2, 'annual', 'observed');
  assert.equal(pay.values.get('zero'), 0);
  assert.equal(ai.values.get('zero'), 0);
  assert.equal(pay.values.get('capped'), null);
  assert.equal(pay.values.get('missing'), null);
  assert.equal(ai.values.get('missing'), null);
  assert.notDeepEqual(
    depthDimension(d.occupations, work, 'pay', 4, 'annual', 'observed').values,
    dimensions[1].values,
  );
  assert.notDeepEqual(
    depthDimension(d.occupations, work, 'ai', 2, 'annual', 'applicability')
      .values,
    dimensions[2].values,
  );
  const hourly = depthDimension(
    d.occupations,
    work,
    'pay',
    2,
    'hourly',
    'observed',
  );
  assert(hourly.label.includes('hourly'));
  assert(hourly.high.includes('$'));
  assert.equal(JSON.stringify(d), before);
  const started = performance.now();
  for (let i = 0; i < 60; i++) {
    const scene = cloud3D(
      d.occupations,
      d.clusters,
      dimensions[0].values,
      rotateCamera(INITIAL_CAMERA, i, i),
      1500,
      900,
      360,
    );
    clusterLabels(scene.clusters, 1, 1500, 900);
  }
  console.log(
    `3D projection + labels: ${((performance.now() - started) / 60).toFixed(1)}ms/frame for ${d.occupations.length} roles (excludes browser paint).`,
  );
}
// Quartile color mapping is nonlinear, robust to tails, and independent of spatial averaging.
{
  const scale = fieldQuartiles([
    0,
    10,
    20,
    30,
    40,
    null,
    NaN,
    Infinity,
    undefined,
  ]);
  assert.deepEqual(scale, { q1: 10, median: 20, q3: 30 });
  assert.equal(iqrColorValue(10, scale), 0);
  assert.equal(iqrColorValue(20, scale), 0.5);
  assert.equal(iqrColorValue(30, scale), 1);
  assert.equal(iqrColorValue(-100, scale), 0);
  assert.equal(iqrColorValue(1000, scale), 1);
  assert.notEqual(iqrColorValue(12.5, scale), 0.125); // Not a linear ramp.
  const positions = Array.from({ length: 101 }, (_, i) =>
    iqrColorValue(i / 2, scale),
  );
  assert(
    positions.every(
      (v, i) => v >= 0 && v <= 1 && (!i || v >= positions[i - 1]),
    ),
  );
  assert.deepEqual(fieldQuartiles([0, 10, 20, 30, 40000]), scale); // A larger outlier cannot flatten the middle.
  assert.deepEqual(fieldQuartiles([0, 10, 20, 30]), {
    q1: 7.5,
    median: 15,
    q3: 22.5,
  });
  assert.equal(fieldQuartiles([]), null);
  assert.equal(iqrColorValue(1, null), 0.5);
  assert.equal(iqrColorValue(5, fieldQuartiles([5])), 0.5);
  assert.equal(iqrColorValue(0, fieldQuartiles([0, 0, 0, 0])), 0.5);
  assert.equal(iqrColorValue(1, fieldQuartiles([0, 0, 0, 0, 1])), 1);
  for (const values of [
    [0, 0, 0, 1, 2],
    [0, 1, 2, 2, 2],
  ]) {
    const tied = fieldQuartiles(values);
    assert(values.every((v) => Number.isFinite(iqrColorValue(v, tied))));
    assert.equal(iqrColorValue(tied.median, tied), 0.5);
  }
  const constantScale = fieldQuartiles([0.7, 0.7, 0.7]);
  for (const dims of [2, 3]) {
    const constantField = intensityField(
      [
        { x: 0.4, y: 0.5, z: 0.5, value: 0.7 },
        { x: 0.6, y: 0.5, z: 0.5, value: 0.7 },
      ],
      dims,
      0.08,
    );
    assert(
      constantField.cells.every(
        (c) => iqrColorValue(c.value, constantScale) === 0.5,
      ),
    );
  }
  const work = workStyles(d);
  for (const metric of ['pay', 'ai']) {
    const dimension = depthDimension(
      d.occupations,
      work,
      metric,
      2,
      'annual',
      'observed',
    );
    const quartiles = fieldQuartiles(dimension.values.values());
    assert(quartiles.q1 < quartiles.median && quartiles.median < quartiles.q3);
    const originalUnits = fieldQuartiles(
      [...dimension.values.values()].map((v) =>
        v === null ? null : v * dimension.max,
      ),
    );
    for (const v of dimension.values.values())
      if (v !== null)
        assert(
          Math.abs(
            iqrColorValue(v, quartiles) -
              iqrColorValue(v * dimension.max, originalUnits),
          ) < 1e-10,
        );
    const changed = depthDimension(
      d.occupations,
      work,
      metric,
      4,
      'annual',
      'applicability',
    );
    assert.notDeepEqual(fieldQuartiles(changed.values.values()), quartiles);
    for (const palette of ['blue-red', 'monochrome'])
      assert.deepEqual(
        fieldColor(iqrColorValue(quartiles.median, quartiles), palette),
        fieldColor(0.5, palette),
      );
  }
}
// Fields encode a continuous local average, not discrete groups or occupation density.
{
  const samples = [
    { x: 0.4, y: 0.5, z: 0.5, value: 0 },
    { x: 0.6, y: 0.5, z: 0.5, value: 1 },
  ];
  for (const dimensions of [2, 3]) {
    const field = intensityField(samples, dimensions, 0.08);
    assert(
      field.cells.length > 0 && field.cells.length < field.size ** dimensions,
    );
    assert(
      field.cells.every(
        (c) => c.value >= 0 && c.value <= 1 && c.support > 0 && c.support <= 1,
      ),
    );
    const distance = (c) =>
      Math.hypot(c.x - 0.5, c.y - 0.5, dimensions === 3 ? c.z - 0.5 : 0);
    const middle = field.cells.toSorted((a, b) => distance(a) - distance(b))[0];
    assert(middle.value > 0.2 && middle.value < 0.8); // A blended color exists between endpoint values.
    const zeros = intensityField(
      samples.map((s) => ({ ...s, value: 0 })),
      dimensions,
      0.08,
    );
    assert(zeros.cells.length > 0 && zeros.cells.every((c) => c.value === 0));
    const uniform = intensityField(
      samples.map((s) => ({ ...s, value: 0.7 })),
      dimensions,
      0.08,
    );
    assert(uniform.cells.every((c) => Math.abs(c.value - 0.7) < 1e-5));
    const doubled = intensityField([...samples, ...samples], dimensions, 0.08);
    const duplicateValues = new Map(
      doubled.cells.map((c) => [c.index, c.value]),
    );
    assert(
      field.cells.every(
        (c) => Math.abs(c.value - duplicateValues.get(c.index)) < 1e-5,
      ),
    );
    const wider = intensityField(samples, dimensions, 0.15);
    assert(wider.cells.length > field.cells.length);
    assert.deepEqual(intensityField([], dimensions, 0.08).cells, []);
    assert.deepEqual(
      intensityField([{ x: NaN, y: 0.5, z: 0.5, value: 0.4 }], dimensions, 0.08)
        .cells,
      [],
    );
  }
  assert(fieldColor(0, 'blue-red')[2] > fieldColor(0, 'blue-red')[0]);
  assert(fieldColor(1, 'blue-red')[0] > fieldColor(1, 'blue-red')[2]);
  assert.notDeepEqual(
    fieldColor(0.48, 'blue-red'),
    fieldColor(0.52, 'blue-red'),
  );
  for (const v of [0, 0.5, 1])
    assert.equal(new Set(fieldColor(v, 'monochrome')).size, 1);
  const layout = occupationLayout(d, 'skills');
  const work = workStyles(d);
  const depth = depthDimension(
    d.occupations,
    work,
    'work',
    2,
    'annual',
    'observed',
  );
  const measure = depthDimension(
    d.occupations,
    work,
    'ai',
    2,
    'annual',
    'observed',
  );
  const clean = mappable3D(layout, depth.values, measure.values);
  assert(clean.length > 0 && clean.length < layout.length);
  assert(
    clean.every(
      (o) =>
        !o.imputedMeasurements &&
        depth.values.get(o.id) !== null &&
        measure.values.get(o.id) !== null,
    ),
  );
  const base = { ...layout[0], imputedMeasurements: 0 };
  const zeros = new Map([[base.id, 0]]);
  assert.deepEqual(mappable3D([base], zeros, zeros), [base]);
  assert.deepEqual(mappable3D([base], zeros, new Map()), []);
  assert.deepEqual(
    mappable3D([{ ...base, imputedMeasurements: 1 }], zeros),
    [],
  );
  assert.deepEqual(mappable3D([{ ...base, x: NaN }], zeros), []);
  const invalid = new Map([[base.id, NaN]]);
  assert.deepEqual(mappable3D([base], invalid), []);
  const started = performance.now();
  const field = intensityField(
    clean.map((o) => ({
      ...o,
      z: depth.values.get(o.id),
      value: measure.values.get(o.id),
    })),
    3,
    0.08,
  );
  console.log(
    `3D field: ${clean.length} measured roles → ${field.cells.length} samples in ${(performance.now() - started).toFixed(0)}ms; recalculated only when data or smoothing changes.`,
  );
}
// Resize delivery must not synchronously resize the observed layout again.
{
  const original = {
    ResizeObserver: globalThis.ResizeObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  let notify,
    observed,
    disconnected = false,
    nextFrame = 0;
  const frames = new Map();
  globalThis.ResizeObserver = class {
    constructor(callback) {
      notify = callback;
    }
    observe(element, options) {
      observed = [element, options];
    }
    disconnect() {
      disconnected = true;
    }
  };
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const resize = (width, height) =>
    notify([{ borderBoxSize: [{ inlineSize: width, blockSize: height }] }]);
  const paint = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  };
  try {
    const element = {};
    const sizes = [];
    const stop = observeViewport(element, (size) => {
      sizes.push(size);
      resize(size.width, size.height); // Simulate layout reporting the published size again.
    });
    assert.deepEqual(observed, [element, { box: 'border-box' }]);
    resize(1200, 800);
    resize(1100, 700);
    assert.equal(sizes.length, 0);
    assert.equal(frames.size, 1);
    paint();
    assert.deepEqual(sizes, [{ width: 1100, height: 700 }]);
    paint();
    assert.equal(sizes.length, 1);
    assert.equal(frames.size, 0);
    resize(0, 0);
    paint();
    assert.equal(sizes.length, 1);
    resize(1000, 600);
    stop();
    paint();
    assert(disconnected);
    assert.equal(sizes.length, 1);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
}
const prefills = JSON.parse(
  readFileSync(new URL('../public/background-options.json', import.meta.url)),
);
// Cached search must preserve accents, transpositions, repeated characters and substitution fallback.
for (const [name, query, expected] of [
  ['Éducation', 'education', 1],
  ['abcd', 'abdc', 0.105],
  ['aabbcc', 'abc', 0.176361746715],
  ['abcdefghij', 'abcdefx', 0.0516923076923077],
  ['abcdefghij', 'zyxwvu', 0],
]) {
  const item = { id: 'example', name, aliases: [name] };
  for (let repeat = 0; repeat < 2; repeat++)
    assert(Math.abs(titleScore(item, query) - expected) < 1e-12);
}
const selectedCustom = { id: 'custom:mine', name: 'My own school' };
assert.deepEqual(
  pickerSuggestions(prefills.source.items, '  ', [selectedCustom], true),
  prefills.source.items.slice(0, 50),
);
assert.deepEqual(pickerSuggestions([], '', [selectedCustom]), [selectedCustom]);
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
// Background links preserve source identity and never manufacture proficiency or eligibility.
const cs = prefills.major.items.find((item) => item.id === 'cip:11.0701');
const mit = prefills.source.items.find((item) => item.id === 'ipeds:166683');
const pmp = prefills.training.items.find((item) =>
  item.name.startsWith('Project Management Professional —'),
);
assert(cs.occupations.includes(dev.id));
assert(pmp.occupations.includes('13-1082.00'));
assert(
  !validPrefills({
    ...prefills,
    major: { ...prefills.major, items: [{ ...cs, occupations: ['bad-code'] }] },
  }),
);
assert(
  !validPrefills({
    ...prefills,
    source: {
      ...prefills.source,
      items: [{ ...mit, programs: [{ id: cs.id, awards: ['bachelor'] }] }],
    },
  }),
);
const allIds = new Set(d.occupations.map((o) => o.id));
const allMajors = new Set(prefills.major.items.map((m) => m.id));
for (const item of [...prefills.major.items, ...prefills.training.items]) {
  assert(item.occupations.every((id) => allIds.has(id)));
  assert.equal(new Set(item.occupations).size, item.occupations.length);
}
for (const item of prefills.source.items)
  assert(item.programs.every((p) => allMajors.has(p.id)));
const background = {
  ...EMPTY_BACKGROUND,
  source: mit.name,
  major: cs.name,
  training: pmp.name,
  hobbies: 'woodworking\nphotography\nwriting',
};
const connected = connectBackground(background, prefills, d);
assert.equal(connected.length, 6);
assert(schoolPrograms(connected).has(cs.id));
assert(
  schoolMajorEvidence(mit, cs, 4).includes('at your selected degree level'),
);
assert(
  schoolMajorEvidence(mit, { id: 'cip:99.9999' }, 4).includes(
    'No award record',
  ),
);
assert(schoolMajorEvidence(undefined, cs, 4).includes('No award record'));
const csLink = connected.find((c) => c.field === 'major');
assert.equal(connectionStrength(dev, csLink), 2);
assert(csLink.skills.some((id) => d.skills[Number(id)].name === 'Programming'));
assert(
  schoolMajorEvidence(
    { programs: [{ id: cs.id, awards: [7] }] },
    cs,
    4,
  ).includes('but not'),
);
assert(schoolMajorEvidence(mit, cs, 0).includes('Choose your degree'));
assert.equal(
  connectBackground(
    { ...EMPTY_BACKGROUND, hobbies: 'photography\nphotography' },
    prefills,
    d,
  ).length,
  1,
);
const schoolLink = connected.find((c) => c.field === 'source');
assert.equal(schoolLink.skills.length, 0);
assert.equal(schoolLink.occupations.length, 0);
assert.equal(connectionStrength(dev, schoolLink), 0);
const woodworking = connected.find((c) => c.name === 'woodworking');
const equipment = String(
  d.skills.findIndex((s) => s.name === 'Equipment Selection'),
);
assert(woodworking.skills.includes(equipment));
const photos = connected.find((c) => c.name === 'photography');
assert(photos.skills.includes(equipment));
const fromBackground = compileSkills([], {}, d.skills, connected);
assert(
  fromBackground.every(
    (s) => !s.confirmed && s.suggestedLevel === null && s.level === 0,
  ),
);
assert.equal(
  fromBackground
    .find((s) => s.id === equipment)
    .sources.filter((s) => ['woodworking', 'photography'].includes(s.title))
    .length,
  2,
);
assert.equal(alignment(dev, {}).score, null);
assert(
  compileSkills([], { [equipment]: 1.5 }, d.skills, connected).find(
    (s) => s.id === equipment,
  ).confirmed,
);
const unlisted = connectBackground(
  {
    ...EMPTY_BACKGROUND,
    hobbies: 'My unlisted activity',
    source: 'Programming University',
    physical: 'programming',
  },
  null,
  d,
);
assert.equal(unlisted.length, 2);
assert(unlisted.every((c) => !c.skills.length && !c.occupations.length));
const linkedCustom = connectBackground(
  { ...EMPTY_BACKGROUND, hobbies: 'My unlisted activity' },
  null,
  d,
  { [unlisted[1].id]: [equipment, equipment, '999', '-1'] },
);
assert.deepEqual(linkedCustom[0].skills, [equipment]);
const removed = connectBackground(background, prefills, d, {
  [woodworking.id]: [],
});
assert.deepEqual(removed.find((c) => c.id === woodworking.id).skills, []);
assert.deepEqual(
  connectBackground(EMPTY_BACKGROUND, prefills, d, {
    [woodworking.id]: [equipment],
  }),
  [],
);
assert.deepEqual(
  connectBackground(background, prefills, null).flatMap((c) => c.skills),
  [],
);
console.log(
  `Background mapping: ${prefills.source.items.filter((s) => s.programs.length).length} schools with awards, ${prefills.major.items.filter((m) => m.occupations.length).length} linked fields, ${prefills.training.items.filter((c) => c.occupations.length).length} linked certifications.`,
);
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
// Database filters compose without changing source records, and use the active wage scenario.
{
  const all = { industries: [], minPay: null, maxPay: null };
  const missing = {
    ...dev,
    id: 'missing',
    industries: ['31'],
    wage: undefined,
  };
  const capped = {
    ...dev,
    id: 'capped',
    industries: ['31', '54'],
    wage: {
      ...dev.wage,
      annual: Array(5).fill({ value: 239200, capped: true }),
    },
  };
  const roles = [dev, missing, capped];
  assert.deepEqual(filterDatabase(roles, all, 2, 'annual'), roles);
  assert.deepEqual(
    filterDatabase(roles, { ...all, minPay: 200000 }, 2, 'annual'),
    [capped],
  );
  assert.deepEqual(
    filterDatabase(roles, { ...all, minPay: 200000 }, 4, 'annual'),
    [dev, capped],
  );
  assert.deepEqual(
    filterDatabase([capped], { ...all, minPay: 250000 }, 2, 'annual'),
    [],
  );
  assert.deepEqual(
    filterDatabase([capped], { ...all, maxPay: 300000 }, 2, 'annual'),
    [],
  );
  assert.deepEqual(
    filterDatabase([missing], { ...all, minPay: 0 }, 2, 'annual'),
    [],
  );
  assert.deepEqual(
    filterDatabase(roles, { ...all, minPay: 2, maxPay: 1 }, 2, 'annual'),
    [],
  );
  assert.deepEqual(
    filterDatabase(roles, { ...all, minPay: NaN }, 2, 'annual'),
    [],
  );
  assert.deepEqual(
    filterDatabase(roles, { ...all, maxPay: -1 }, 2, 'annual'),
    [],
  );
  assert.deepEqual(
    filterDatabase([dev], { ...all, minPay: 100000 }, 2, 'hourly'),
    [],
  );
  const hourly = wageAt(dev, 2, 'hourly').value;
  assert.deepEqual(
    filterDatabase(
      [dev],
      { ...all, minPay: hourly, maxPay: hourly },
      2,
      'hourly',
    ),
    [dev],
  );
  assert.deepEqual(
    filterDatabase(
      [missing, capped],
      { ...all, industries: ['54'] },
      2,
      'annual',
    ),
    [capped],
  );
  assert.deepEqual(
    filterDatabase(
      [missing, capped],
      { ...all, industries: ['31', '54'] },
      2,
      'annual',
    ),
    [missing, capped],
  );
  assert.deepEqual(
    filterDatabase(
      [missing, capped],
      { industries: ['31'], minPay: 200000, maxPay: null },
      2,
      'annual',
    ),
    [capped],
  );
  assert.deepEqual(
    filterDatabase(roles, { ...all, industries: ['unknown'] }, 2, 'annual'),
    [],
  );
  assert.equal(d.industries.length, 20);
  const industries = new Set(d.industries.map((i) => i.id));
  for (const o of d.occupations) {
    assert(Array.isArray(o.industries));
    assert.equal(new Set(o.industries).size, o.industries.length);
    assert(o.industries.every((id) => industries.has(id)));
  }
  assert(dev.industries.includes('54'));
  assert(
    d.occupations.find((o) => o.id === '17-2112.03').industries.includes('31'),
  );
  for (const basis of ['skills', 'activities']) {
    const layout = occupationLayout(d, basis);
    const matches = filterDatabase(
      searchOccupations(layout, 'engineer', null, 0),
      { industries: ['31'], minPay: 80000, maxPay: 180000 },
      2,
      'annual',
    );
    assert(matches.length > 0);
    assert(
      matches.every(
        (o) =>
          o.industries.includes('31') &&
          wageAt(o, 2).value >= 80000 &&
          wageAt(o, 2).value <= 180000,
      ),
    );
    const landscape = careerLandscape(
      matches,
      basis === 'skills' ? d.layouts.skills.clusters : d.clusters,
      new Map(),
      false,
    );
    assert.deepEqual(landscape.occupations, matches);
    assert.equal(
      landscape.clusters.reduce((sum, c) => sum + c.count, 0),
      matches.length,
    );
    assert(landscape.clusters.every((c) => c.count > 0));
  }
}
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
// The tree is exhaustive before filters; every known guardrail failure is excluded before layout.
const treeScores = new Map(
  d.occupations.map((o) => [o.id, alignment(o, full)]),
);
const allTree = possibilityTree(d.occupations, treeScores, new Map());
assert.deepEqual(
  new Set(allTree.branches.flatMap((b) => b.roles.map((o) => o.id))),
  allIds,
);
assert.equal(allTree.branches.length, d.clusters.length);
assert.equal(allTree.positions.size, 923);
assert.equal(new Set(allTree.positions.values()).size, 923);
for (const branch of allTree.branches) {
  assert(branch.roles.every((o) => o.cluster === branch.id));
  branch.roles.forEach((o, i) => {
    assert(allTree.positions.get(o.id) > branch.y);
    assert(allTree.positions.get(o.id) + 40 < allTree.height);
    if (i) {
      assert(
        (treeScores.get(branch.roles[i - 1].id).score ?? -1) >=
          (treeScores.get(o.id).score ?? -1),
      );
      assert(
        allTree.positions.get(o.id) -
          allTree.positions.get(branch.roles[i - 1].id) >=
          64,
      );
    }
  });
}
for (const cutoff of [0, 50, 80, 100]) {
  const filtered = possibilityTree(
    d.occupations,
    treeScores,
    new Map(),
    cutoff,
    false,
  );
  assert.deepEqual(
    new Set(filtered.ranked.map((o) => o.id)),
    new Set(
      d.occupations
        .filter(
          (o) =>
            treeScores.get(o.id).score !== null &&
            treeScores.get(o.id).score >= cutoff,
        )
        .map((o) => o.id),
    ),
  );
  assert.equal(
    filtered.branches.flatMap((b) => b.roles).length,
    filtered.ranked.length,
  );
}
const sparseScores = new Map([
  [dev.id, { score: 80, coverage: 5 }],
  [clerk.id, { score: 20, coverage: 5 }],
]);
assert.deepEqual(
  possibilityTree([dev, clerk], sparseScores, new Map(), 80).ranked.map(
    (o) => o.id,
  ),
  [dev.id],
);
assert.equal(
  possibilityTree(d.occupations, new Map(), new Map()).ranked.length,
  923,
);
assert.equal(
  possibilityTree(d.occupations, new Map(), new Map(), 0, false).ranked.length,
  0,
);
assert.deepEqual(possibilityTree([], new Map(), new Map()).branches, []);
assert(
  possibilityTree(d.occupations, treeScores, new Map(), 0, true).ranked.some(
    (o) => o.id === clerk.id,
  ),
);
const before = performance.now();
for (const minFit of [0, 80, 95, 100]) {
  const criteria = { ...base, minFit };
  const quality = qualities(full, criteria);
  const tree = possibilityTree(
    d.occupations,
    treeScores,
    quality,
    criteria.minFit,
  );
  const expected = d.occupations.filter(
    (o) =>
      quality.get(o.id).status !== 'below' &&
      (treeScores.get(o.id).score === null ||
        treeScores.get(o.id).score >= criteria.minFit),
  );
  assert.deepEqual(
    new Set(tree.ranked.map((o) => o.id)),
    new Set(expected.map((o) => o.id)),
  );
  assert.deepEqual(
    new Set(tree.positions.keys()),
    new Set(expected.map((o) => o.id)),
  );
  assert.equal(tree.branches.flatMap((b) => b.roles).length, expected.length);
  assert(
    tree.branches.every(
      (b) =>
        b.roles.length > 0 &&
        b.roles.every((o) => quality.get(o.id).status !== 'below'),
    ),
  );
}
// Pay percentile changes remove and restore even a 100-fit role; unscored inclusion cannot override failures.
const payGuard = { ...base, payFloor: 150000 };
assert.equal(
  possibilityTree([dev], treeScores, qualities(full, payGuard, 2), base.minFit)
    .ranked.length,
  0,
);
assert.equal(
  possibilityTree([dev], treeScores, qualities(full, payGuard, 4), base.minFit)
    .ranked.length,
  1,
);
assert.equal(
  possibilityTree([dev], new Map(), qualities({}, payGuard, 2), 0, true).ranked
    .length,
  0,
);
assert.equal(
  possibilityTree([clerk], treeScores, outcome, 0, true).ranked.length,
  0,
);
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
      // Parent zoom and label scaling cancel: text stays 14px on screen.
      assert(Math.abs(14 * label.scale * zoom - 14) < 1e-10);
      const normal = clusterLabels(
        [clusters.find((c) => c.id === label.id)],
        1,
      )[0];
      assert(Math.abs(label.width * zoom - normal.width) < 1e-10);
      assert(Math.abs(label.height * zoom - normal.height) < 1e-10);
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
// The cloud uses its actual viewport; labels and points share the same projection.
for (const [width, height] of [
  [1318, 490],
  [920, 450],
  [360, 340],
]) {
  for (const cluster of d.clusters) {
    const point = mapPoint(cluster, width, height);
    const label = clusterLabels([cluster], 1, width, height)[0];
    assert.equal(point.x, label.anchorX);
    assert.equal(point.y, label.anchorY);
    assert(point.x > 0 && point.x < width && point.y > 0 && point.y < height);
    assert(label.x >= 0 && label.x + label.width <= width);
    assert(label.y >= 0 && label.y + label.height <= height);
  }
  for (const clusters of [d.clusters, d.layouts.skills.clusters]) {
    const labels = clusterLabels(clusters, 1, width, height);
    assert(labels.length > 0);
    for (const [i, a] of labels.entries())
      for (const b of labels.slice(i + 1)) {
        assert(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
        );
      }
  }
  const points = d.occupations.map((o) => mapPoint(o, width, height));
  assert(
    Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)) >
      width * 0.7,
  );
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
