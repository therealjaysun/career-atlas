import type { Cluster, Dataset, Occupation } from './career';

export type WorkStyle = {
  physical: number | null;
  manual: number | null;
  knowledge: number | null;
  balance: number | null;
};
export type WorkFilter = 'all' | 'knowledge' | 'physical';

export function workStyles(
  data: Pick<Dataset, 'occupations' | 'abilities'> | null,
) {
  const result = new Map<string, WorkStyle>();
  if (!data) return result;
  const groups = ['1.A.3.', '1.A.2.', '1.A.1.'].map((prefix) =>
    data.abilities.flatMap((a, i) => (a.id.startsWith(prefix) ? [i] : [])),
  );
  for (const o of data.occupations) {
    const [physical, manual, knowledge] = groups.map((ids) => {
      const values = ids
        .map((i) => o.abilities?.[i])
        .filter(
          (v): v is number =>
            typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 7,
        );
      // Require at least 80% coverage in every domain; suppressed values stay unknown.
      return ids.length && values.length >= Math.ceil(ids.length * 0.8)
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : null;
    });
    result.set(o.id, { physical, manual, knowledge, balance: null });
  }
  const complete = [...result.values()].filter(
    (s) => s.physical !== null && s.manual !== null && s.knowledge !== null,
  );
  const ranks = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const map = new Map<number, number>();
    for (let first = 0; first < sorted.length;) {
      let end = first + 1;
      while (end < sorted.length && sorted[end] === sorted[first]) end++;
      map.set(
        sorted[first],
        sorted.length === 1
          ? 50
          : (50 * (first + end - 1)) / (sorted.length - 1),
      );
      first = end;
    }
    return map;
  };
  const handsOn = (s: WorkStyle) => (s.physical! + s.manual!) / 2;
  const physicalRanks = ranks(complete.map(handsOn));
  const knowledgeRanks = ranks(complete.map((s) => s.knowledge!));
  // ponytail: relative ability ranks are an exploratory proxy; use validated task-time weights for a working-time measure.
  for (const s of complete)
    s.balance = Math.round(
      (physicalRanks.get(handsOn(s))! +
        100 -
        knowledgeRanks.get(s.knowledge!)!) /
        2,
    );
  return result;
}

export function matchesWorkStyle(
  style: WorkStyle | undefined,
  filter: WorkFilter,
  threshold: number,
) {
  if (filter === 'all') return true;
  if (
    style?.balance == null ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 100
  )
    return false;
  return filter === 'physical'
    ? style.balance >= threshold
    : style.balance <= threshold;
}

export function workStyleColor(balance: number | null | undefined) {
  if (balance == null || !Number.isFinite(balance)) return '#737d75';
  const t = Math.max(0, Math.min(1, balance / 100));
  const a = [45, 91, 119],
    b = [159, 113, 37];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`;
}

export function workStyleLandscape(
  occupations: Occupation[],
  clusters: Cluster[],
  styles: Map<string, WorkStyle>,
  leftInset = 0,
) {
  const left = Math.max(0, Math.min(0.45, leftInset));
  const middle = (left + 1) / 2;
  const bounds = {
    knowledge: { left: left + 0.02, right: middle - 0.035 },
    physical: { left: middle + 0.035, right: 0.98 },
  };
  const side = (o: Occupation) => {
    const value = styles.get(o.id)?.balance;
    return value == null ? 'unknown' : value >= 50 ? 'physical' : 'knowledge';
  };
  const unknown = occupations
    .filter((o) => side(o) === 'unknown')
    .sort((a, b) => a.id.localeCompare(b.id));
  const unknownPositions = new Map(unknown.map((o, i) => [o.id, i]));
  const placed = occupations.map((o) => {
    const half = side(o);
    if (half === 'unknown')
      return {
        ...o,
        x:
          left +
          0.05 +
          ((0.9 - left) * (unknownPositions.get(o.id)! + 0.5)) / unknown.length,
        y: 0.93,
      };
    const b = bounds[half];
    return { ...o, x: b.left + o.x * (b.right - b.left), y: 0.19 + o.y * 0.61 };
  });
  const groups = (['knowledge', 'physical'] as const).flatMap((half) =>
    clusters.flatMap((cluster) => {
      const members = placed.filter(
        (o) => o.cluster === cluster.id && side(o) === half,
      );
      return members.length
        ? [
            {
              ...cluster,
              labelKey: `${half}:${cluster.id}`,
              labelBounds: bounds[half],
              count: members.length,
              x: members.reduce((sum, o) => sum + o.x, 0) / members.length,
              y: members.reduce((sum, o) => sum + o.y, 0) / members.length,
            },
          ]
        : [];
    }),
  );
  return {
    occupations: placed,
    clusters: groups,
    bounds,
    middle,
    unknownCount: unknown.length,
  };
}
