import { defaultFilter } from 'cmdk';

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
  aliases?: string[];
  abilities?: (number | null)[];
  ai?: {
    soc: string;
    observed: number | null;
    observedTitle: string | null;
    applicability: number | null;
    applicabilityTitle: string | null;
    usage: {
      title: string;
      pct?: number;
      collaboration_bucket_automation_pct?: number;
      collaboration_bucket_augmentation_pct?: number;
    } | null;
  };
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
  abilities: { id: string; name: string }[];
  aiRetrieved?: string;
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
export const EDUCATION = [
  'Not provided',
  'No degree / high school',
  'Some college',
  'Associate / vocational',
  'Bachelor’s degree',
  'Master’s degree',
  'Doctorate / PhD',
  'Professional degree',
];
export type Background = {
  source: string;
  major: string;
  hobbies: string;
  talents: string;
  training: string;
  athletics: string;
  physical: string;
};
export const EMPTY_BACKGROUND: Background = {
  source: '',
  major: '',
  hobbies: '',
  talents: '',
  training: '',
  athletics: '',
  physical: '',
};
export type SearchItem = { id: string; name: string; aliases?: string[] };
const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function titleScore(item: SearchItem, query: string) {
  const q = normalize(query.slice(0, 160));
  if (!q) return 1;
  if (item.id.startsWith(query.trim())) return 1;
  let best = 0;
  for (const name of [item.name, ...(item.aliases ?? [])]) {
    const n = normalize(name);
    let score = defaultFilter(n, q);
    // A short trigram fallback also catches substitutions that subsequence search misses.
    if (!score && q.length >= 5) {
      const grams = new Set(
        Array.from({ length: q.length - 2 }, (_, i) => q.slice(i, i + 3)),
      );
      const other = new Set(
        Array.from({ length: n.length - 2 }, (_, i) => n.slice(i, i + 3)),
      );
      const overlap = [...grams].filter((g) => other.has(g)).length;
      const similarity = (2 * overlap) / (grams.size + other.size);
      if (similarity >= 0.6) score = similarity * 0.08;
    }
    best = Math.max(
      best,
      score > 0 ? Math.min(1, score * (name === item.name ? 1.05 : 0.95)) : 0,
    );
    if (best === 1) break;
  }
  return best;
}
export function searchOccupations(
  occupations: Occupation[],
  query: string,
  cluster: number | null,
  zone: number,
) {
  return occupations
    .filter(
      (o) =>
        (cluster === null || o.cluster === cluster) &&
        (!zone || (o.zone !== null && o.zone <= zone)),
    )
    .map((o) => ({
      o,
      score: !query.trim()
        ? 1
        : titleScore({ id: o.id, name: o.title, aliases: o.aliases }, query) ||
          (o.tasks.some((t) => normalize(t).includes(normalize(query)))
            ? 0.03
            : 0),
    }))
    .filter((x) => x.score >= 0.025)
    .sort((a, b) => b.score - a.score || a.o.title.localeCompare(b.o.title))
    .map((x) => x.o);
}
export function backgroundOverlap(o: Occupation, background: Background) {
  // ponytail: keyword affinity surfaces interests, not credential equivalence or proficiency. Replace with a validated taxonomy if this becomes an assessment.
  const words = new Set(
    normalize([o.title, ...(o.aliases ?? []), ...o.tasks].join(' ')).split(' '),
  );
  const stop = new Set([
    'with',
    'from',
    'that',
    'this',
    'have',
    'level',
    'degree',
    'training',
    'work',
    'school',
    'college',
    'university',
    'good',
    'very',
    'ability',
  ]);
  return [
    ...new Set(
      normalize(
        [
          background.major,
          background.hobbies,
          background.talents,
          background.training,
          background.athletics,
        ].join(' '),
      ).split(' '),
    ),
  ].filter((t) => t.length >= 4 && !stop.has(t) && words.has(t));
}
export type AIMetric = 'observed' | 'applicability';
export const AI_SOURCES = {
  observed: {
    name: 'Observed exposure',
    date: 'March 5, 2026',
    source: 'https://www.anthropic.com/research/labor-market-impacts',
    data: 'https://huggingface.co/datasets/Anthropic/EconomicIndex/tree/main/labor_market_impacts',
    description:
      'Anthropic’s time-weighted task exposure index combines feasible LLM tasks with observed professional Claude use, giving automation more weight than augmentation.',
  },
  applicability: {
    name: 'AI applicability',
    date: 'December 22, 2025 · v6',
    source: 'https://arxiv.org/abs/2507.07935v6',
    data: 'https://github.com/microsoft/working-with-ai',
    description:
      'Microsoft’s index combines activity coverage, successful completion, and scope of AI assistance in Bing Copilot conversations. It measures applicability, including assistance.',
  },
};
export function aiValue(o: Occupation, metric: AIMetric) {
  const v = o.ai?.[metric];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
    ? v
    : null;
}
export function aiLabel(o: Occupation, metric: AIMetric) {
  const v = aiValue(o, metric);
  return v === null
    ? 'AI data unavailable'
    : `${(v * 100).toFixed(1)}/100 ${AI_SOURCES[metric].name.toLowerCase()}`;
}
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
  return searchOccupations([o], query, cluster, zone).length > 0;
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
  abilities: Profile = {},
  abilityNames: { name: string }[] = [],
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
    else if (o.zone <= Math.min(criteria.education, 5) - 2)
      reasons.push(
        'Potential underemployment: typical preparation is well below your education',
      );
  }
  for (const [id, value] of Object.entries(abilities)) {
    if (!Number.isFinite(value)) continue;
    const required = o.abilities?.[Number(id)];
    if (required == null)
      unknown.push(
        `${abilityNames[Number(id)]?.name ?? 'Ability'} demand not reported`,
      );
    else if (required > value + 0.5)
      cautions.push(
        `Review ${abilityNames[Number(id)]?.name ?? 'ability'} demands: ${required}/7 typical vs your ${value}/7. Consider supports, accommodations, and training.`,
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
