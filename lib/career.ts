export const PERCENTILES = [10, 25, 50, 75, 90] as const;
export const COLORS = [
  '#d2b074',
  '#a4a0ed',
  '#79cbb7',
  '#de91ad',
  '#9abbe9',
  '#74d5c0',
  '#b49bfa',
  '#e6aa80',
  '#d39de4',
  '#a9c982',
  '#8ca6c0',
  '#d5cd93',
];
export const CLUSTER_NAMES = [
  'Transport & logistics',
  'Engineering & design',
  'Repair & maintenance',
  'Business support',
  'School education',
  'Health & care',
  'Science & technology',
  'Production & processing',
  'Sales & services',
  'Research & teaching',
  'Trades & practical work',
  'Leadership & management',
];
export type WagePoint = { value: number; capped: boolean } | null;
export type Occupation = {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
  cluster: number;
  zone: number | null;
  tasks: string[];
  activities: number[];
  skills: (number | null)[];
  importance: (number | null)[];
  neighbors: [string, number][];
  trend?: {
    employment: number | null;
    growth: number | null;
    openings: number | null;
    start?: number | null;
    end?: number | null;
    source: string;
    group?: string | null;
  };
  wage?: {
    year: number | null;
    source: string;
    soc: string;
    group?: string | null;
    annual: WagePoint[];
    hourly: WagePoint[];
    error?: string;
  };
};
export type Dataset = {
  version: string;
  excluded: number;
  totalOccupations: number;
  method: string;
  skills: { id: string; name: string }[];
  activities: string[];
  clusters: {
    id: number;
    count: number;
    x: number;
    y: number;
    activities: string[];
    representatives: string[];
  }[];
  occupations: Occupation[];
  wageSource?: string;
  wageRetrieved?: string;
};
export type Profile = Record<string, number>;
export function alignment(o: Occupation, profile: Profile) {
  let knownWeight = 0,
    totalWeight = 0,
    covered = 0;
  o.skills.forEach((required, i) => {
    if (required === null || required <= 0) return;
    const weight = Math.max(0, (o.importance[i] ?? 1) - 1);
    totalWeight += weight;
    const actual = profile[i];
    if (actual === undefined || !Number.isFinite(actual)) return;
    knownWeight += weight;
    // ponytail: self-ratings are heuristic O*NET-scale estimates; calibrate with task evidence before making readiness claims.
    covered += weight * Math.min(1, Math.max(0, actual) / required);
  });
  return {
    score: knownWeight ? Math.round((100 * covered) / knownWeight) : null,
    coverage: totalWeight ? Math.round((100 * knownWeight) / totalWeight) : 0,
  };
}
export function wageAt(
  o: Occupation,
  index: number,
  unit: 'annual' | 'hourly' = 'annual',
): WagePoint {
  if (!Number.isInteger(index) || index < 0 || index >= PERCENTILES.length)
    return null;
  return o.wage?.[unit]?.[index] ?? null;
}
const moneyFormats = Object.fromEntries(
  ['annual', 'hourly'].flatMap((unit) =>
    [false, true].map((compact) => [
      `${unit}-${compact}`,
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: unit === 'hourly' ? 2 : 0,
      }),
    ]),
  ),
);
export function money(
  point: WagePoint,
  compact = false,
  unit: 'annual' | 'hourly' = 'annual',
) {
  if (!point) return 'Not reported';
  return (
    moneyFormats[`${unit}-${compact}`].format(point.value) +
    (point.capped ? '+' : '')
  );
}
export function payColor(
  point: WagePoint,
  unit: 'annual' | 'hourly' = 'annual',
) {
  if (!point) return '#626574';
  const t = Math.max(
    0,
    Math.min(
      1,
      (Math.log(point.value) - Math.log(unit === 'annual' ? 30000 : 15)) /
        Math.log(7),
    ),
  );
  return `hsl(${190 + t * 90} ${52 + t * 22}% ${58 + t * 12}%)`;
}
export function matches(
  o: Occupation,
  query: string,
  cluster: number | null,
  zone: number,
) {
  return (
    (cluster === null || o.cluster === cluster) &&
    (!zone || (o.zone !== null && o.zone <= zone)) &&
    (!query ||
      `${o.title} ${o.id} ${o.tasks.join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()))
  );
}
export type Criteria = {
  education: number;
  payFloor: number;
  minFit: number;
  minGrowth: number;
  minOpenings: number;
};
export const DEFAULT_CRITERIA: Criteria = {
  education: 0,
  payFloor: 60000,
  minFit: 80,
  minGrowth: 0,
  minOpenings: 1000,
};
export const QUALITY = {
  strong: { label: 'Strong path', color: '#75d5b2', order: 3 },
  tradeoff: { label: 'Trade-offs', color: '#e6bd7a', order: 2 },
  unknown: { label: 'Needs more evidence', color: '#8e92aa', order: 1 },
  below: { label: 'Below your thresholds', color: '#e18f9f', order: 0 },
};
export function pathQuality(
  o: Occupation,
  profile: Profile,
  criteria: Criteria,
  percentile: number,
) {
  const fit = alignment(o, profile),
    wage = wageAt(o, percentile),
    t = o.trend;
  const reasons: string[] = [],
    unknown: string[] = [],
    cautions: string[] = [];
  const enoughSkills =
    fit.score !== null &&
    fit.coverage >= 20 &&
    Object.keys(profile).length >= 4;
  if (!enoughSkills)
    unknown.push(
      'Rate at least 4 skills covering 20% of this role’s skill importance',
    );
  else if (fit.score! < criteria.minFit)
    reasons.push(
      `Skill alignment ${fit.score}/100 is below ${criteria.minFit}`,
    );
  else if (fit.score! < criteria.minFit + 8)
    cautions.push('Skill alignment is near your minimum');
  if (criteria.payFloor > 0) {
    if (!wage) unknown.push('Annual wage not reported');
    else if (wage.capped && wage.value < criteria.payFloor)
      unknown.push(
        'Published wage lower bound is below your target; actual percentile is unknown',
      );
    else if (wage.value < criteria.payFloor)
      reasons.push(
        `Pay at P${PERCENTILES[percentile]} is below your ${money({ value: criteria.payFloor, capped: false }, true)} annual target`,
      );
  }
  // ponytail: Job Zone is a preparation proxy, not a degree requirement; use education distributions for a calibrated underemployment model.
  if (criteria.education === 0)
    unknown.push('Add education to assess potential underemployment');
  if (criteria.education >= 4) {
    if (o.zone === null) unknown.push('Preparation level not reported');
    else if (o.zone <= criteria.education - 2)
      reasons.push(
        'Potential underemployment: typical preparation is well below your education',
      );
  }
  if (
    t?.growth === null ||
    t?.growth === undefined ||
    t?.openings === null ||
    t?.openings === undefined
  )
    unknown.push('Employment outlook not reported');
  else {
    if (t.growth < criteria.minGrowth)
      reasons.push(
        `${t.growth}% projected growth is below your ${criteria.minGrowth}% minimum`,
      );
    if (t.openings < criteria.minOpenings)
      reasons.push(
        `${t.openings.toLocaleString()} annual openings is below your ${criteria.minOpenings.toLocaleString()} minimum`,
      );
    if (t.growth >= criteria.minGrowth && t.growth < criteria.minGrowth + 2)
      cautions.push('Projected employment growth is near your minimum');
  }
  const status: keyof typeof QUALITY = reasons.length
    ? 'below'
    : unknown.length
      ? 'unknown'
      : cautions.length
        ? 'tradeoff'
        : 'strong';
  return { status, reasons, unknown, cautions, fit };
}
