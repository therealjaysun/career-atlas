import { defaultFilter } from 'cmdk';

export const PERCENTILES = [10, 25, 50, 75, 90] as const;
export const COLORS = [
  '#38665f',
  '#996622',
  '#617442',
  '#537587',
  '#a55438',
  '#466644',
  '#805b51',
  '#397970',
  '#876d3b',
  '#446485',
  '#815c38',
  '#72713e',
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
  imputedMeasurements?: number;
  aliases?: string[];
  industries?: string[];
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
export type Cluster = {
  id: number;
  name: string;
  count: number;
  x: number;
  y: number;
  features: string[];
  representatives: string[];
  meanLevels?: number[];
  featureBasis?: 'relative-demand' | 'reported-level';
  labelKey?: string;
  labelBounds?: { left: number; right: number };
};
export type ClusterBasis = 'activities' | 'skills';
export function mapPoint(
  o: { x: number; y: number },
  width = 1200,
  height = 800,
) {
  const left = Math.min(100, width * 0.12);
  const top = Math.min(80, height * 0.1);
  return {
    x: left + o.x * (width - left * 2),
    y: top + o.y * (height - top - Math.min(100, height * 0.14)),
  };
}
export type DepthAxis = 'work' | 'pay' | 'ai';
export const INITIAL_CAMERA = { yaw: -0.55, pitch: 0.35 };
export function rotateCamera(
  camera: typeof INITIAL_CAMERA,
  dx: number,
  dy: number,
) {
  return {
    yaw: (camera.yaw + dx * 0.006) % (Math.PI * 2),
    pitch: Math.max(-1.2, Math.min(1.2, camera.pitch + dy * 0.006)),
  };
}

// Reference scales use the complete dataset, so filtering never moves a role along the depth axis.
export function depthDimension(
  occupations: Occupation[],
  work: Map<string, { balance: number | null }>,
  axis: DepthAxis,
  percentile: number,
  unit: 'annual' | 'hourly',
  aiMetric: AIMetric,
) {
  const raw = new Map(
    occupations.map((o) => {
      const pay = wageAt(o, percentile, unit);
      return [
        o.id,
        axis === 'work'
          ? (work.get(o.id)?.balance ?? null)
          : axis === 'ai'
            ? aiValue(o, aiMetric)
            : pay?.capped
              ? null
              : (pay?.value ?? null),
      ] as const;
    }),
  );
  const max =
    axis === 'work'
      ? 100
      : axis === 'ai'
        ? 1
        : Math.max(
            1,
            ...[...raw.values()].filter((v): v is number => v !== null),
          );
  const label =
    axis === 'work'
      ? 'Work style'
      : axis === 'ai'
        ? AI_SOURCES[aiMetric].name
        : `Pay · P${PERCENTILES[percentile]} · ${unit}`;
  return {
    label,
    low:
      axis === 'work'
        ? 'Knowledge · 0'
        : axis === 'ai'
          ? 'AI index · 0'
          : money({ value: 0, capped: false }, true, unit),
    high:
      axis === 'work'
        ? 'Physical/manual · 100'
        : axis === 'ai'
          ? 'AI index · 100'
          : money({ value: max, capped: false }, true, unit),
    missing: axis === 'pay' ? 'Missing or top-coded pay' : 'Missing depth data',
    values: new Map(
      [...raw].map(([id, v]) => [id, v === null ? null : v / max]),
    ),
    labels: new Map(
      [...raw].map(([id, v]) => [
        id,
        v === null
          ? 'Depth unavailable'
          : axis === 'pay'
            ? `${label}: ${money({ value: v, capped: false }, false, unit)}`
            : `${label}: ${(axis === 'ai' ? v * 100 : v).toFixed(axis === 'ai' ? 1 : 0)}/100`,
      ]),
    ),
  };
}

// Only measured coordinates and active dimensions belong in the 3D scene.
export function mappable3D(
  occupations: Occupation[],
  values: Map<string, number | null>,
  field?: Map<string, number | null>,
) {
  const measured = (v: number | null | undefined) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  return occupations.filter(
    (o) =>
      Number.isFinite(o.x) &&
      Number.isFinite(o.y) &&
      !o.imputedMeasurements &&
      measured(values.get(o.id)) &&
      (!field || measured(field.get(o.id))),
  );
}

// ponytail: perspective SVG is sufficient for 923 roles; use WebGL only if larger datasets outgrow it.
export function cloud3D(
  occupations: Occupation[],
  clusters: Cluster[],
  values: Map<string, number | null>,
  camera: typeof INITIAL_CAMERA,
  width: number,
  height: number,
  leftInset = 0,
) {
  const inset = Math.max(0, Math.min(width * 0.45, leftInset));
  const size = Math.max(1, Math.min((width - inset) * 0.62, height * 0.6));
  const origin = mapPoint({ x: 0, y: 0 }, width, height);
  const end = mapPoint({ x: 1, y: 1 }, width, height);
  const cy = Math.cos(camera.yaw),
    sy = Math.sin(camera.yaw);
  const cp = Math.cos(camera.pitch),
    sp = Math.sin(camera.pitch);
  const project = (p: { x: number; y: number; z: number }) => {
    const x = p.x - 0.5,
      y = 0.5 - p.y,
      z = p.z - 0.5;
    const rx = x * cy + z * sy,
      rz = -x * sy + z * cy;
    const ry = y * cp - rz * sp,
      depth = y * sp + rz * cp;
    const scale = 2.8 / (2.8 - depth);
    return {
      x:
        ((inset + width) / 2 + rx * size * scale - origin.x) /
        Math.max(1, end.x - origin.x),
      y:
        (height * 0.46 - ry * size * scale - origin.y) /
        Math.max(1, end.y - origin.y),
      depth,
      scale,
    };
  };
  const mapped = mappable3D(occupations, values);
  const points = new Map(
    mapped.map((o) => [o.id, project({ ...o, z: values.get(o.id)! })]),
  );
  const placed = mapped.map((o) => ({
    ...o,
    x: points.get(o.id)!.x,
    y: points.get(o.id)!.y,
  }));
  const groups = clusters.flatMap((c) => {
    const all = placed.filter((o) => o.cluster === c.id);
    if (!all.length) return [];
    const members = all;
    return [
      {
        ...c,
        labelBounds: undefined,
        count: all.length,
        x: members.reduce((sum, o) => sum + o.x, 0) / members.length,
        y: members.reduce((sum, o) => sum + o.y, 0) / members.length,
      },
    ];
  });
  const corners = Array.from({ length: 8 }, (_, i) =>
    project({ x: i & 1, y: (i >> 1) & 1, z: (i >> 2) & 1 }),
  );
  const edges = corners.flatMap((a, i) =>
    [1, 2, 4].filter((bit) => !(i & bit)).map((bit) => [a, corners[i | bit]]),
  );
  return {
    occupations: placed,
    clusters: groups,
    points,
    edges,
    project,
    worldScale: size,
    excludedCount: occupations.length - mapped.length,
  };
}

export function clusterLabels(
  clusters: Cluster[],
  zoom: number,
  viewportWidth = 1200,
  viewportHeight = 800,
) {
  const scale = 1 / zoom;
  const placed: { x: number; y: number; width: number; height: number }[] = [];
  return clusters.flatMap((c) => {
    const lines = c.name.split(' · ').flatMap((part) => {
      const rows = [''];
      for (const word of part.split(/\s+/)) {
        const last = rows.length - 1;
        if (rows[last] && rows[last].length + word.length + 1 > 26)
          rows.push(word);
        else rows[last] += `${rows[last] ? ' ' : ''}${word}`;
      }
      return rows;
    });
    // ponytail: conservative text-width estimates avoid DOM measurement; use font metrics if labels become multilingual.
    const width =
      (Math.max(...lines.map((line) => line.length)) * 8.4 + 20) * scale;
    const height = (lines.length * 18 + 12) * scale;
    const { x: anchorX, y: anchorY } = mapPoint(
      c,
      viewportWidth,
      viewportHeight,
    );
    const minX = c.labelBounds
      ? mapPoint({ x: c.labelBounds.left, y: 0 }, viewportWidth, viewportHeight)
          .x
      : 12;
    const maxX = c.labelBounds
      ? mapPoint(
          { x: c.labelBounds.right, y: 0 },
          viewportWidth,
          viewportHeight,
        ).x
      : viewportWidth - 12;
    let best = { x: 0, y: 0, score: Infinity };
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -4; dy <= 4; dy++) {
        const x = Math.max(
          minX,
          Math.min(maxX - width, anchorX - width / 2 + dx * width * 0.65),
        );
        const y = Math.max(
          12,
          Math.min(
            viewportHeight - 12 - height,
            anchorY - height - 20 * scale + dy * (height + 14 * scale),
          ),
        );
        const overlap = placed.reduce(
          (sum, p) =>
            sum +
            Math.max(
              0,
              Math.min(x + width + 8 * scale, p.x + p.width) -
                Math.max(x - 8 * scale, p.x),
            ) *
              Math.max(
                0,
                Math.min(y + height + 8 * scale, p.y + p.height) -
                  Math.max(y - 8 * scale, p.y),
              ),
          0,
        );
        const score =
          overlap * 1e6 +
          (x + width / 2 - anchorX) ** 2 +
          (y + height + 20 * scale - anchorY) ** 2;
        if (score < best.score) best = { x, y, score };
      }
    }
    const label = {
      id: c.id,
      key: c.labelKey ?? String(c.id),
      name: c.name,
      lines,
      width,
      height,
      x: best.x,
      y: best.y,
      anchorX,
      anchorY,
      scale,
    };
    // At narrow widths, omit colliding labels until zoom/filtering leaves room; every occupation remains visible.
    if (
      label.width > maxX - minX ||
      label.height > viewportHeight - 24 ||
      placed.some(
        (p) =>
          Math.min(label.x + width, p.x + p.width) > Math.max(label.x, p.x) &&
          Math.min(label.y + height, p.y + p.height) > Math.max(label.y, p.y),
      )
    )
      return [];
    placed.push(label);
    return [label];
  });
}
export type Dataset = {
  version: string;
  excluded: number;
  totalOccupations: number;
  method: string;
  skills: { id: string; name: string }[];
  abilities: { id: string; name: string }[];
  aiRetrieved?: string;
  activities: string[];
  clusters: Cluster[];
  layouts: {
    skills: {
      method: string;
      dimensions: number;
      imputedValues: number;
      clusters: Cluster[];
      occupations: Record<
        string,
        Pick<
          Occupation,
          'x' | 'y' | 'cluster' | 'neighbors' | 'imputedMeasurements'
        >
      >;
    };
  };
  occupations: Occupation[];
  industries?: { id: string; name: string; source: string }[];
  industryRetrieved?: string;
  wageSource?: string;
  wageRetrieved?: string;
};
export function occupationLayout(
  data: Dataset | null,
  basis: ClusterBasis,
): Occupation[] {
  if (!data) return [];
  if (basis === 'activities') return data.occupations;
  return data.occupations.map((o) => ({
    ...o,
    ...data.layouts.skills.occupations[o.id],
  }));
}
export type Profile = Record<string, number>;
export type SkillConnection = { id: string; name: string; skills: string[] };
export function compileSkills(
  jobs: Occupation[],
  profile: Profile,
  skills: { name: string }[],
  connections: SkillConnection[] = [],
) {
  const uniqueJobs = [...new Map(jobs.map((job) => [job.id, job])).values()];
  return skills
    .map((skill, index) => {
      const jobSources = uniqueJobs.flatMap((job) => {
        const level = job.skills[index];
        return level != null &&
          Number.isFinite(level) &&
          level > 0 &&
          level <= 7
          ? [{ id: job.id, title: job.title, level }]
          : [];
      });
      const rating = profile[index];
      const confirmed = Number.isFinite(rating) && rating >= 0 && rating <= 7;
      const suggestedLevel = jobSources.length
        ? Math.max(...jobSources.map((s) => s.level))
        : null;
      const sources = [
        ...jobSources,
        ...connections
          .filter((c) => c.skills.includes(String(index)))
          .map((c) => ({
            id: c.id,
            title: c.name,
            level: null,
          })),
      ];
      return {
        id: String(index),
        name: skill.name,
        sources,
        suggestedLevel,
        confirmed,
        level: confirmed ? rating : (suggestedLevel ?? 0),
      };
    })
    .filter((skill) => skill.confirmed || skill.sources.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}
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
export const ENTRY_PATHS: Record<
  number,
  { label: string; description: string }
> = {
  2: {
    label: 'High school & job training',
    description:
      'Often high school or a GED, with little to some previous experience. Training on the job can take a few days to a year.',
  },
  3: {
    label: 'Trade school or associate degree',
    description:
      'Often vocational training, an apprenticeship, an associate degree, or related work experience.',
  },
  4: {
    label: 'Usually a bachelor’s degree',
    description:
      'Most roles involve a four-year degree and substantial related experience or training. Some follow other routes.',
  },
  5: {
    label: 'Usually a graduate degree',
    description:
      'Most roles involve a master’s, doctorate, or professional degree, plus extensive experience or specialized training.',
  },
};
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
export type SearchItem = {
  id: string;
  name: string;
  aliases?: string[];
  custom?: boolean;
  occupations?: string[];
  programs?: { id: string; awards: number[] }[];
};
export const PREFILL_FIELDS = [
  'source',
  'hobbies',
  'training',
  'major',
] as const;
export type PrefillField = (typeof PREFILL_FIELDS)[number];
export type Prefills = Record<
  PrefillField,
  {
    label: string;
    snapshot: string;
    url: string;
    items: SearchItem[];
  }
>;
export function validPrefills(value: unknown): value is Prefills {
  if (!value || typeof value !== 'object') return false;
  return PREFILL_FIELDS.every((key) => {
    const source = (value as Prefills)[key];
    return (
      source &&
      typeof source.label === 'string' &&
      typeof source.snapshot === 'string' &&
      typeof source.url === 'string' &&
      source.url.startsWith('https://') &&
      Array.isArray(source.items) &&
      source.items.every(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          item.id.length > 0 &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0 &&
          item.name.length <= 500 &&
          (item.aliases === undefined ||
            (Array.isArray(item.aliases) &&
              item.aliases.every((a) => typeof a === 'string'))) &&
          (item.occupations === undefined ||
            (Array.isArray(item.occupations) &&
              item.occupations.every(
                (id) =>
                  typeof id === 'string' && /^\d{2}-\d{4}\.\d{2}$/.test(id),
              ))) &&
          (item.programs === undefined ||
            (Array.isArray(item.programs) &&
              item.programs.every(
                (p) =>
                  p &&
                  typeof p.id === 'string' &&
                  /^cip:\d{2}\.\d{4}$/.test(p.id) &&
                  Array.isArray(p.awards) &&
                  p.awards.every(
                    (a) =>
                      Number.isInteger(a) &&
                      [2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21].includes(a),
                  ),
              ))),
      ) &&
      new Set(source.items.map((item) => item.id)).size === source.items.length
    );
  });
}

export function pickerSuggestions(
  items: SearchItem[],
  query: string,
  selected: SearchItem[] = [],
  allowCustom = false,
) {
  if (!query.trim() && items.length >= 50) return items.slice(0, 50);
  const ids = new Set(items.map((item) => item.id));
  const all = [...items, ...selected.filter((item) => !ids.has(item.id))];
  const q = normalize(query);
  const direct = q
    ? all.filter((item) => searchNames(item).some((name) => name.includes(q)))
    : all;
  const scoreTitle = titleScorer(query);
  const found = (direct.length ? direct : all)
    .map((item) => ({ item, score: scoreTitle(item) }))
    .filter((entry) => entry.score >= 0.025)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((entry) => entry.item);
  const custom = query.trim();
  const fold = (text: string) => text.trim().normalize('NFKC').toLowerCase();
  const foldedCustom = fold(custom);
  if (
    allowCustom &&
    custom &&
    !all.some((item) => fold(item.name) === foldedCustom)
  )
    found.push({ id: `custom:${foldedCustom}`, name: custom, custom: true });
  return found;
}
const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Dataset and picker records are immutable; weak keys release replaced records.
const namesByItem = new WeakMap<SearchItem | Occupation, string[]>();
const tasksByOccupation = new WeakMap<Occupation, string[]>();
function searchNames(item: SearchItem | Occupation) {
  let names = namesByItem.get(item);
  if (!names) {
    names = [
      'name' in item ? item.name : item.title,
      ...(item.aliases ?? []),
    ].map(normalize);
    namesByItem.set(item, names);
  }
  return names;
}
function titleScorer(query: string) {
  const q = normalize(query.slice(0, 160));
  const prefix = query.trim();
  const letters = [...new Set(q)];
  const grams =
    q.length >= 5
      ? new Set(
          Array.from({ length: q.length - 2 }, (_, i) => q.slice(i, i + 3)),
        )
      : null;
  return (item: SearchItem | Occupation) => {
    if (!q || item.id.startsWith(prefix)) return 1;
    let best = 0;
    const names = searchNames(item);
    for (let index = 0; index < names.length; index++) {
      const n = names[index];
      if (n === q) return 1;
      // Subsequence/transposition matching cannot succeed if a query character is absent.
      let score = letters.every((letter) => n.includes(letter))
        ? defaultFilter(n, q)
        : 0;
      // A short trigram fallback also catches substitutions that subsequence search misses.
      if (!score && grams) {
        let overlap = 0;
        for (const gram of grams) if (n.includes(gram)) overlap++;
        // The name has at least `overlap` distinct grams: skip allocation if even that upper bound cannot match.
        if (2 * overlap >= 0.6 * (grams.size + overlap)) {
          const other = new Set(
            Array.from({ length: Math.max(0, n.length - 2) }, (_, i) =>
              n.slice(i, i + 3),
            ),
          );
          const similarity = (2 * overlap) / (grams.size + other.size);
          if (similarity >= 0.6) score = similarity * 0.08;
        }
      }
      best = Math.max(
        best,
        score > 0 ? Math.min(0.99, score * (index === 0 ? 1.05 : 0.95)) : 0,
      );
    }
    return best;
  };
}
export function titleScore(item: SearchItem, query: string) {
  return titleScorer(query)(item);
}
export function searchOccupations(
  occupations: Occupation[],
  query: string,
  cluster: number | null,
  zone: number,
) {
  const q = normalize(query);
  const scoreTitle = titleScorer(query);
  const taskMatch = (o: Occupation) => {
    let tasks = tasksByOccupation.get(o);
    if (!tasks) {
      tasks = o.tasks.map(normalize);
      tasksByOccupation.set(o, tasks);
    }
    return tasks.some((task) => task.includes(q));
  };
  return occupations
    .filter(
      (o) =>
        (cluster === null || o.cluster === cluster) &&
        (!zone || (o.zone !== null && o.zone <= zone)),
    )
    .map((o) => ({
      o,
      score: !query.trim() ? 1 : scoreTitle(o) || (taskMatch(o) ? 0.03 : 0),
    }))
    .filter((x) => x.score >= 0.025)
    .sort((a, b) => b.score - a.score || a.o.title.localeCompare(b.o.title))
    .map((x) => x.o);
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
export function filterDatabase(
  occupations: Occupation[],
  filters: {
    industries: string[];
    minPay: number | null;
    maxPay: number | null;
  },
  percentile: number,
  unit: 'annual' | 'hourly',
) {
  const { industries, minPay, maxPay } = filters;
  if (
    [minPay, maxPay].some(
      (value) => value !== null && (!Number.isFinite(value) || value < 0),
    ) ||
    (minPay !== null && maxPay !== null && minPay > maxPay)
  )
    return [];
  return occupations.filter((o) => {
    if (
      industries.length &&
      !industries.some((id) => o.industries?.includes(id))
    )
      return false;
    if (minPay === null && maxPay === null) return true;
    const wage = wageAt(o, percentile, unit);
    if (!wage || (minPay !== null && wage.value < minPay)) return false;
    // A censored wage is a lower bound, so it cannot prove a finite upper limit.
    return maxPay === null || (!wage.capped && wage.value <= maxPay);
  });
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
  if (!point) return '#737d75';
  const t = Math.max(
    0,
    Math.min(
      1,
      (Math.log(point.value) - Math.log(unit === 'annual' ? 30000 : 15)) /
        Math.log(7),
    ),
  );
  return `hsl(${154 + t * 12} ${20 + t * 18}% ${44 - t * 22}%)`;
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
  strong: { label: 'Strong path', color: '#24664e', order: 3 },
  tradeoff: { label: 'Trade-offs', color: '#94611c', order: 2 },
  unknown: { label: 'Needs more evidence', color: '#69766f', order: 1 },
  below: { label: 'Below your thresholds', color: '#b14832', order: 0 },
};

export function possibilityTree(
  occupations: Occupation[],
  scores: Map<string, { score: number | null }>,
  quality: Map<string, { status: keyof typeof QUALITY }>,
  minScore = 0,
  includeUnscored = true,
) {
  const ranked = occupations
    .filter((o) => {
      if (quality.get(o.id)?.status === 'below') return false;
      const score = scores.get(o.id)?.score;
      return score == null ? includeUnscored : score >= minScore;
    })
    .sort(
      (a, b) =>
        (scores.get(b.id)?.score ?? -1) - (scores.get(a.id)?.score ?? -1) ||
        a.title.localeCompare(b.title),
    );
  let y = 300;
  const positions = new Map<string, number>();
  const branches = [...new Set(ranked.map((o) => o.cluster))].map((id) => {
    const roles = ranked.filter((o) => o.cluster === id);
    const branchY = y;
    roles.forEach((o, i) => positions.set(o.id, y + 64 + i * 64));
    y += 96 + roles.length * 64;
    return { id, roles, y: branchY };
  });
  return { ranked, branches, positions, height: y + 240 };
}

export function careerLandscape(
  occupations: Occupation[],
  clusters: Cluster[],
  quality: Map<string, { status: keyof typeof QUALITY }>,
  focus: boolean,
) {
  const remaining = focus
    ? occupations.filter((o) => quality.get(o.id)?.status !== 'below')
    : occupations;
  const groups = clusters.flatMap((cluster) => {
    const members = remaining.filter((o) => o.cluster === cluster.id);
    return members.length
      ? [{ ...cluster, count: members.length, members }]
      : [];
  });
  if (!focus || !remaining.length)
    return { occupations: remaining, clusters: groups };

  // ponytail: deterministic circle packing preserves group membership, not UMAP distances.
  // Pairwise relaxation is bounded for this 923-role dataset; use a spatial index if it grows.
  const bubbles = groups.map((group) => ({
    ...group,
    x: (group.x - 0.5) * 700,
    y: (group.y - 0.5) * 434,
    radius: 14 + 10 * Math.sqrt(group.count),
  }));
  const separate = (
    points: { x: number; y: number; radius: number }[],
    gap: number,
  ) => {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i],
          b = points[j];
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const overlap = a.radius + b.radius + gap - distance;
        if (overlap <= 0) continue;
        const angle = ((i * 137.5 + j) * Math.PI) / 180;
        const ux = distance ? dx / distance : Math.cos(angle);
        const uy = distance ? dy / distance : Math.sin(angle);
        a.x -= (ux * overlap) / 2;
        a.y -= (uy * overlap) / 2;
        b.x += (ux * overlap) / 2;
        b.y += (uy * overlap) / 2;
      }
    }
  };
  for (let step = 0; step < 80; step++) {
    bubbles.forEach((b) => {
      b.x *= 0.985;
      b.y *= 0.985;
    });
    separate(bubbles, 22);
  }
  const positions = new Map<string, { x: number; y: number }>();
  for (const b of bubbles) {
    const cx = b.members.reduce((s, o) => s + o.x, 0) / b.count;
    const cy = b.members.reduce((s, o) => s + o.y, 0) / b.count;
    const spread = Math.max(
      1,
      ...b.members.map((o) => Math.hypot((o.x - cx) * 1000, (o.y - cy) * 620)),
    );
    const points = b.members.map((o) => ({
      id: o.id,
      x: (((o.x - cx) * 1000) / spread) * (b.radius - 14),
      y: (((o.y - cy) * 620) / spread) * (b.radius - 14),
      radius: 7,
    }));
    for (let step = 0; step < 40; step++) {
      separate(points, 1);
      for (const p of points) {
        const scale = Math.min(1, (b.radius - 7) / (Math.hypot(p.x, p.y) || 1));
        p.x *= scale;
        p.y *= scale;
      }
    }
    points.forEach((p) => positions.set(p.id, { x: b.x + p.x, y: b.y + p.y }));
  }
  const left = Math.min(...bubbles.map((b) => b.x - b.radius));
  const right = Math.max(...bubbles.map((b) => b.x + b.radius));
  const top = Math.min(...bubbles.map((b) => b.y - b.radius));
  const bottom = Math.max(...bubbles.map((b) => b.y + b.radius));
  const scale = Math.min(960 / (right - left), 580 / (bottom - top), 1.8);
  const project = (p: { x: number; y: number }) => ({
    x: 0.5 + ((p.x - (left + right) / 2) * scale) / 1000,
    y: 0.5 + ((p.y - (top + bottom) / 2) * scale) / 620,
  });
  return {
    occupations: remaining.map((o) => ({
      ...o,
      ...project(positions.get(o.id)!),
    })),
    clusters: bubbles.map((b) => ({ ...b, ...project(b) })),
  };
}

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
    if (o.zone === null)
      unknown.push('Typical education and training not reported');
    else if (o.zone <= Math.min(criteria.education, 5) - 2)
      reasons.push(
        'Potential underemployment: this role typically calls for much less education or training than you have',
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
