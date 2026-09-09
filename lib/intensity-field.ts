export type FieldSample = { x: number; y: number; z: number; value: number };
const FIELD_COLORS = [
  [37, 93, 155],
  [224, 230, 232],
  [176, 43, 48],
];
export function fieldQuartiles(values: Iterable<number | null | undefined>) {
  const sorted = [...values]
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const quantile = (p: number) => {
    const i = (sorted.length - 1) * p;
    const lo = Math.floor(i),
      hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  };
  return { q1: quantile(0.25), median: quantile(0.5), q3: quantile(0.75) };
}
export type FieldQuartiles = ReturnType<typeof fieldQuartiles>;

// Apply color scaling after spatial averaging, so the field still averages measured values.
export function iqrColorValue(value: number, quartiles: FieldQuartiles) {
  if (!quartiles || !Number.isFinite(value)) return 0.5;
  const { q1, median, q3 } = quartiles;
  if (value === median) return 0.5;
  const span = value < median ? median - q1 : q3 - median;
  // If one half is tied, use the remaining IQR; constant data stays neutral.
  const width = span || q3 - q1;
  // Float32 spatial averages can differ slightly from an otherwise constant input.
  if (!width)
    return Math.abs(value - median) < 1e-5 ? 0.5 : value < median ? 0 : 1;
  const t = Math.max(0, Math.min(1, Math.abs(value - median) / width));
  const smooth = t * t * (3 - 2 * t);
  return 0.5 + (value < median ? -0.5 : 0.5) * smooth;
}
export function fieldColor(value: number, metric: 'pay' | 'ai' = 'ai') {
  if (metric === 'pay') value = 1 - value;
  const stops = FIELD_COLORS;
  const t = Math.max(0, Math.min(1, value)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  return stops[i].map((v, c) =>
    Math.round(v + (stops[i + 1][c] - v) * (t - i)),
  );
}

// ponytail: a bounded Gaussian grid covers this dataset; increase resolution or move to a worker if scale demands it.
export function intensityField(
  samples: FieldSample[],
  dimensions: 2 | 3,
  sigma: number,
) {
  const bandwidth = Math.max(
    0.025,
    Math.min(0.18, Number.isFinite(sigma) ? sigma : 0.08),
  );
  const size = dimensions === 3 ? 24 : 96;
  const pad = bandwidth * 3;
  const step = (1 + pad * 2) / (size - 1);
  const length = size ** dimensions;
  const weights = new Float32Array(length),
    sums = new Float32Array(length);
  const kernel = (position: number) => {
    const middle = (position + pad) / step;
    const reach = (bandwidth * 3) / step;
    const first = Math.max(0, Math.ceil(middle - reach));
    const last = Math.min(size - 1, Math.floor(middle + reach));
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, n) => {
      const i = first + n;
      return [
        i,
        Math.exp(-0.5 * (((i - middle) * step) / bandwidth) ** 2),
      ] as const;
    });
  };
  for (const sample of samples) {
    if (
      ![sample.x, sample.y, sample.z, sample.value].every(Number.isFinite) ||
      sample.value < 0 ||
      sample.value > 1
    )
      continue;
    const xs = kernel(sample.x),
      ys = kernel(sample.y);
    const zs = dimensions === 3 ? kernel(sample.z) : [[0, 1]];
    for (const [z, wz] of zs)
      for (const [y, wy] of ys)
        for (const [x, wx] of xs) {
          const i = (z * size + y) * size + x;
          const w = wx * wy * wz;
          weights[i] += w;
          sums[i] += sample.value * w;
        }
  }
  // Weighted means keep color tied to the measure, rather than the number of nearby roles.
  const cells: (FieldSample & { support: number; index: number })[] = [];
  for (let i = 0; i < length; i++) {
    if (weights[i] < 0.015) continue;
    cells.push({
      x: (i % size) * step - pad,
      y: (Math.floor(i / size) % size) * step - pad,
      z: dimensions === 3 ? Math.floor(i / (size * size)) * step - pad : 0,
      value: Math.max(0, Math.min(1, sums[i] / weights[i])),
      support: Math.min(1, weights[i]),
      index: i,
    });
  }
  return { cells, size, pad, step };
}
