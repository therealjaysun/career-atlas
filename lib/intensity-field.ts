export type FieldSample = { x: number; y: number; z: number; value: number };
export type FieldPalette = 'blue-red' | 'monochrome';
export const FIELD_PALETTES = {
  'blue-red': [
    [37, 93, 155],
    [224, 230, 232],
    [176, 43, 48],
  ],
  monochrome: [
    [232, 232, 232],
    [45, 45, 45],
  ],
};
export function fieldColor(value: number, palette: FieldPalette) {
  const stops = FIELD_PALETTES[palette];
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
