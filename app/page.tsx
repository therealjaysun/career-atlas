'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG graph buttons and CSS data meters require explicit ARIA roles. */
import Link from 'next/link';
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Database,
  DollarSign,
  ExternalLink,
  Info,
  Layers,
  LoaderCircle,
  Minus,
  Orbit,
  PanelLeftClose,
  Plus,
  Scan,
  Search,
  Sparkles,
  TrendingUp,
  X,
  GitBranch,
  ShieldAlert,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  alignment,
  compileSkills,
  pathQuality,
  careerLandscape,
  QUALITY,
  DEFAULT_CRITERIA,
  type Criteria,
  occupationLayout,
  type ClusterBasis,
  COLORS,
  searchOccupations,
  titleScore,
  backgroundOverlap,
  EDUCATION,
  EMPTY_BACKGROUND,
  AI_SOURCES,
  aiValue,
  aiLabel,
  type SearchItem,
  type Background,
  type AIMetric,
  money,
  payColor,
  PERCENTILES,
  wageAt,
  type Dataset,
  type Profile,
} from '@/lib/career';

const BACKGROUND_FIELDS: {
  key: keyof Background;
  label: string;
  placeholder: string;
}[] = [
  {
    key: 'source',
    label: 'Education source / school / provider',
    placeholder: 'University, apprenticeship, online provider…',
  },
  {
    key: 'major',
    label: 'Major / field of study',
    placeholder: 'Computer science, biology, history…',
  },
  {
    key: 'training',
    label: 'Specialized training / certifications',
    placeholder: 'Welding, CPR, cloud certification…',
  },
  {
    key: 'hobbies',
    label: 'Hobbies & interests',
    placeholder: 'Photography, gardening, robotics…',
  },
  {
    key: 'talents',
    label: 'Talents & strengths',
    placeholder: 'Writing, mathematics, public speaking…',
  },
  {
    key: 'athletics',
    label: 'Athletic experience / ability',
    placeholder: 'Swimming, climbing, coaching…',
  },
  {
    key: 'physical',
    label: 'Physical capability / supports / preferences',
    placeholder: 'Lifting comfort, stamina, supports you use…',
  },
];

function Bubble({
  step,
  title,
  subtitle,
  open,
  onOpenChange,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="bubble phase-bubble"
    >
      <CollapsibleTrigger className="phase-trigger">
        <span>
          <span className="step-label">{step}</span>
          <h2>{title}</h2>
        </span>
        <ChevronDown size={16} className={open ? 'rotated' : ''} />
      </CollapsibleTrigger>
      <CollapsibleContent className="phase-content">
        {subtitle && <p>{subtitle}</p>}
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
function ExposureRing({
  x,
  y,
  radius,
  value,
  threshold,
}: {
  x: number;
  y: number;
  radius: number;
  value: number | null;
  threshold: number;
}) {
  const high = value !== null && value * 100 >= threshold;
  return (
    <g className="exposure-ring" aria-hidden="true">
      {high && (
        <circle
          cx={x}
          cy={y}
          r={radius + 3}
          fill="#981f3b"
          opacity={0.12 + value! * 0.22}
        />
      )}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="none"
        stroke={value === null ? '#8c8393' : '#66253a'}
        strokeWidth={1}
        strokeDasharray={value === null ? '2 3' : undefined}
        opacity={0.6}
      />
      {value !== null && value > 0 && (
        <circle
          cx={x}
          cy={y}
          r={radius}
          fill="none"
          pathLength={100}
          stroke={high ? '#ff5976' : '#b94761'}
          strokeWidth={high ? 2.4 : 1.4}
          strokeLinecap="round"
          strokeDasharray={`${value * 100} ${100 - value * 100}`}
          transform={`rotate(-90 ${x} ${y})`}
        />
      )}
    </g>
  );
}
function Picker({
  items,
  value,
  onChange,
  label,
  placeholder,
}: {
  items: SearchItem[];
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  placeholder: string;
}) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(
    () =>
      items
        .map((item) => ({ item, score: titleScore(item, deferredSearch) }))
        .filter((x) => x.score >= 0.025)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map((x) => x.item),
    [items, deferredSearch],
  );
  return (
    <Combobox
      items={items}
      filteredItems={filtered}
      onInputValueChange={setSearch}
      value={items.find((x) => x.id === value) ?? null}
      onValueChange={(v) => onChange(v?.id ?? null)}
      itemToStringLabel={(v) => v.name}
      isItemEqualToValue={(a, b) => a.id === b.id}
    >
      <ComboboxInput
        aria-label={label}
        placeholder={placeholder}
        className="picker-input"
        showClear
      />
      <ComboboxContent className="picker-popup">
        <ComboboxEmpty>No matches found.</ComboboxEmpty>
        <ComboboxList>
          {(item: { id: string; name: string }) => (
            <ComboboxItem key={item.id} value={item}>
              {item.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
function JobPicker({
  items,
  values,
  onChange,
}: {
  items: SearchItem[];
  values: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const anchor = useComboboxAnchor();
  const filtered = useMemo(
    () =>
      items
        .map((item) => ({ item, score: titleScore(item, deferredSearch) }))
        .filter((x) => x.score >= 0.025)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map((x) => x.item),
    [items, deferredSearch],
  );
  return (
    <Combobox
      multiple
      items={items}
      filteredItems={filtered}
      value={values
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is SearchItem => !!item)}
      onValueChange={(items) =>
        onChange([...new Set(items.map((item) => item.id))])
      }
      onInputValueChange={setSearch}
      itemToStringLabel={(item) => item.name}
      isItemEqualToValue={(a, b) => a.id === b.id}
    >
      <ComboboxChips ref={anchor} className="job-chips">
        <ComboboxValue>
          {(selected: SearchItem[]) =>
            selected.map((item) => (
              <ComboboxChip key={item.id} aria-label={item.name}>
                {item.name}
              </ComboboxChip>
            ))
          }
        </ComboboxValue>
        <ComboboxChipsInput
          aria-label="Add previous jobs"
          placeholder="Search and add another job…"
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor} className="picker-popup">
        <ComboboxEmpty>No close titles found.</ComboboxEmpty>
        <ComboboxList>
          {(item: SearchItem) => (
            <ComboboxItem key={item.id} value={item}>
              {item.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
export default function Home() {
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState('');
  const [mode, setMode] = useState('career'),
    [collapsed, setCollapsed] = useState(false),
    [phase, setPhase] = useState(1);
  const [roles, setRoles] = useState<string[]>([]),
    [profile, setProfile] = useState<Profile>({}),
    [skillsOpen, setSkillsOpen] = useState(false),
    [skillDraft, setSkillDraft] = useState<string[]>([]),
    [skillQuery, setSkillQuery] = useState('');
  const [planned, setPlanned] = useState<string | null>(null),
    [plannedLevel, setPlannedLevel] = useState(4),
    [zone, setZone] = useState(0);
  const [criteria, setCriteria] = useState<Criteria>(DEFAULT_CRITERIA);
  const [showAllPaths, setShowAllPaths] = useState(false);
  const [background, setBackground] = useState<Background>(EMPTY_BACKGROUND);
  const deferredBackground = useDeferredValue(background);
  const [abilities, setAbilities] = useState<Profile>({});
  const [aiOverlay, setAiOverlay] = useState(true),
    [aiMetric, setAiMetric] = useState<AIMetric>('observed'),
    [aiThreshold, setAiThreshold] = useState(30),
    [layout, setLayout] = useState('map');
  const [query, setQuery] = useState(''),
    [cluster, setCluster] = useState<number | null>(null),
    [color, setColor] = useState('cluster');
  const [clusterBy, setClusterBy] = useState<ClusterBasis>('skills');
  const basis: ClusterBasis = mode === 'explore' ? clusterBy : 'activities';
  const searchQuery = useDeferredValue(query);
  const [percentile, setPercentile] = useState(2),
    [unit, setUnit] = useState<'annual' | 'hourly'>('annual');
  const [selected, setSelected] = useState<string | null>(null),
    [hovered, setHovered] = useState<string | null>(null),
    [about, setAbout] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 }),
    [focusIndex, setFocusIndex] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null),
    drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(
      null,
    );
  useEffect(() => {
    const c = new AbortController();
    fetch('/onet.json', { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw Error('The occupation dataset could not be loaded.');
        return r.json();
      })
      .then((value) => {
        const d = value as Dataset;
        if (
          !Array.isArray(d.occupations) ||
          !Array.isArray(d.skills) ||
          !d.layouts?.skills
        )
          throw Error('The dataset format is invalid.');
        setData(d);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => c.abort();
  }, []);
  const occupations = useMemo(
    () => occupationLayout(data, basis),
    [data, basis],
  );
  const activeClusters = useMemo(
    () =>
      data
        ? basis === 'skills'
          ? data.layouts.skills.clusters
          : data.clusters
        : [],
    [data, basis],
  );
  const clusterNames = Object.fromEntries(
    activeClusters.map((c) => [c.id, c.name]),
  );
  const selectedCluster = activeClusters.find((c) => c.id === cluster);
  const byId = useMemo(
    () => new Map(occupations.map((o) => [o.id, o])),
    [occupations],
  );
  const skillItems = useMemo(
    () => data?.skills.map((s, i) => ({ id: String(i), name: s.name })) ?? [],
    [data],
  );
  const roleItems = useMemo(
    () =>
      occupations.map((o) => ({ id: o.id, name: o.title, aliases: o.aliases })),
    [occupations],
  );
  const compiled = useMemo(
    () =>
      compileSkills(
        occupations.filter((o) => roles.includes(o.id)),
        profile,
        data?.skills ?? [],
      ),
    [occupations, roles, profile, data],
  );
  const pendingSkills = compiled.filter((skill) => !skill.confirmed);
  const availableSkills = skillItems.filter(
    (skill) =>
      profile[skill.id] === undefined && titleScore(skill, skillQuery) >= 0.025,
  );
  const addSkills = () => {
    setProfile((p) => ({
      ...Object.fromEntries(skillDraft.map((id) => [id, 3])),
      ...p,
    }));
    setSkillDraft([]);
  };
  const abilityItems = useMemo(
    () =>
      data?.abilities.map((a, i) => ({ id: String(i), name: a.name })) ?? [],
    [data],
  );
  const overlaps = useMemo(
    () =>
      new Map(
        occupations.map((o) => [
          o.id,
          backgroundOverlap(o, deferredBackground),
        ]),
      ),
    [occupations, deferredBackground],
  );
  const backgroundSkills = useMemo(() => {
    const related = occupations
      .filter((o) => (overlaps.get(o.id)?.length ?? 0) > 0)
      .sort((a, b) => overlaps.get(b.id)!.length - overlaps.get(a.id)!.length)
      .slice(0, 3);
    return related
      .flatMap((o) =>
        o.importance
          .map((v, i) => ({ i, v: v ?? 0, role: o.title }))
          .sort((a, b) => b.v - a.v)
          .slice(0, 3),
      )
      .filter(
        (s, i, a) =>
          profile[s.i] === undefined && a.findIndex((x) => x.i === s.i) === i,
      )
      .slice(0, 5);
  }, [occupations, overlaps, profile]);
  const effectiveProfile = useMemo(
    () =>
      planned === null
        ? profile
        : {
            ...profile,
            [planned]: Math.max(profile[planned] ?? 0, plannedLevel),
          },
    [profile, planned, plannedLevel],
  );
  const scores = useMemo(
    () =>
      new Map(occupations.map((o) => [o.id, alignment(o, effectiveProfile)])),
    [occupations, effectiveProfile],
  );
  const hasProfile = Object.keys(profile).length > 0 || planned !== null;
  const hasDetails =
    hasProfile ||
    roles.length > 0 ||
    Object.values(background).some((value) => value.trim()) ||
    Object.keys(abilities).length > 0 ||
    Object.entries(criteria).some(
      ([key, value]) => value !== DEFAULT_CRITERIA[key as keyof Criteria],
    );
  const focusPaths = mode === 'career' && hasDetails && !showAllPaths;
  const candidates = useMemo(
    () => searchOccupations(occupations, searchQuery, cluster, zone),
    [occupations, searchQuery, cluster, zone],
  );
  const quality = useMemo(
    () =>
      new Map(
        occupations.map((o) => [
          o.id,
          pathQuality(
            o,
            effectiveProfile,
            criteria,
            percentile,
            abilities,
            data?.abilities,
          ),
        ]),
      ),
    [occupations, data, effectiveProfile, criteria, percentile, abilities],
  );
  const landscape = useMemo(
    () => careerLandscape(candidates, activeClusters, quality, focusPaths),
    [candidates, activeClusters, quality, focusPaths],
  );
  const visible = landscape.occupations;
  const mapById = useMemo(
    () => new Map(visible.map((o) => [o.id, o])),
    [visible],
  );
  const hiddenCount = candidates.length - visible.length;
  const layoutKey = `${basis}:${focusPaths}:${visible.map((o) => o.id).join(',')}`;
  const [fittedLayout, setFittedLayout] = useState(layoutKey);
  if (fittedLayout !== layoutKey) {
    setFittedLayout(layoutKey);
    setView({ x: 0, y: 0, k: 1 });
    setFocusIndex(0);
  }
  const ranked = useMemo(
    () =>
      [...visible].sort((a, b) =>
        mode === 'career'
          ? QUALITY[quality.get(b.id)!.status].order -
              QUALITY[quality.get(a.id)!.status].order ||
            (scores.get(b.id)?.score ?? -1) - (scores.get(a.id)?.score ?? -1) ||
            (overlaps.get(b.id)?.length ?? 0) -
              (overlaps.get(a.id)?.length ?? 0)
          : 0,
      ),
    [visible, mode, scores, quality, overlaps],
  );
  const isTree = mode === 'career' && layout === 'tree';
  const branches = useMemo(
    () =>
      [...new Set(ranked.map((o) => o.cluster))].slice(0, 4).map((id) => ({
        id,
        roles: ranked.filter((o) => o.cluster === id).slice(0, 3),
      })),
    [ranked],
  );
  const treePositions = new Map(
    branches.flatMap((b, bi) =>
      b.roles.map(
        (o, i) => [o.id, { x: 620, y: 100 + bi * 175 + i * 48 }] as const,
      ),
    ),
  );
  const mapOccupations = isTree ? branches.flatMap((b) => b.roles) : visible;
  const strongPaths = visible.filter(
    (o) => quality.get(o.id)?.status === 'strong',
  );
  const exposedPaths = strongPaths.filter(
    (o) => (aiValue(o, aiMetric) ?? -1) * 100 >= aiThreshold,
  ).length;
  const unknownAIPaths = strongPaths.filter(
    (o) => aiValue(o, aiMetric) === null,
  ).length;
  const improved = useMemo(
    () =>
      planned === null
        ? 0
        : visible.filter(
            (o) =>
              (alignment(o, effectiveProfile).score ?? 0) -
                (alignment(o, profile).score ?? 0) >=
              5,
          ).length,
    [visible, profile, effectiveProfile, planned],
  );
  const detail = selected ? byId.get(selected) : null,
    hover = hovered ? mapById.get(hovered) : null;
  const point = (o: { x: number; y: number }) => ({
    x: 100 + o.x * 1000,
    y: 80 + o.y * 620,
  });
  const zoom = (factor: number, anchor = { x: 600, y: 400 }) =>
    setView((v) => {
      const k = Math.max(0.7, Math.min(5, v.k * factor));
      return {
        k,
        x: anchor.x - ((anchor.x - v.x) * k) / v.k,
        y: anchor.y - ((anchor.y - v.y) * k) / v.k,
      };
    });
  const reset = () => {
    setView({ x: 0, y: 0, k: 1 });
    setCluster(null);
    setQuery('');
  };
  const roleSelect = (id: string) => {
    setSelected(id);
    setHovered(null);
  };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = svg.createSVGPoint();
      p.x = e.clientX;
      p.y = e.clientY;
      const m = svg.getScreenCTM();
      if (m)
        zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.matrixTransform(m.inverse()));
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, [data]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context || !data) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'explore_occupation',
            title: 'Explore an occupation',
            description:
              'Open an O*NET occupation and set the displayed wage percentile.',
            inputSchema: {
              type: 'object',
              properties: {
                occupationId: { type: 'string' },
                percentile: { type: 'number', enum: [10, 25, 50, 75, 90] },
              },
              required: ['occupationId'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: async (input: unknown) => {
              const v = input as { occupationId?: string; percentile?: number };
              if (
                !v ||
                typeof v.occupationId !== 'string' ||
                !byId.has(v.occupationId) ||
                (v.percentile !== undefined &&
                  !PERCENTILES.some((p) => p === v.percentile))
              )
                throw Error(
                  'Choose a valid O*NET occupation code and published percentile.',
                );
              setMode('explore');
              setSelected(v.occupationId);
              if (v.percentile !== undefined)
                setPercentile(PERCENTILES.findIndex((p) => p === v.percentile));
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
              );
              return {
                occupation: byId.get(v.occupationId)?.title,
                percentile: v.percentile ?? PERCENTILES[percentile],
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [data, byId, percentile]);
  return (
    <main className={`atlas ${collapsed ? 'panel-hidden' : ''}`}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Atlas home">
          <Orbit size={28} />
          <span>
            atlas<span className="brand-dot">.</span>
          </span>
          <span className="brand-caption">A WORLD OF POSSIBILITIES</span>
        </Link>
        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(String(v));
            setQuery('');
            setCluster(null);
            setHovered(null);
            setFocusIndex(0);
            setView({ x: 0, y: 0, k: 1 });
            if (v === 'explore' && color === 'quality') setColor('cluster');
          }}
        >
          <TabsList className="mode-switch">
            <TabsTrigger value="career">
              <Compass />
              Career navigation
            </TabsTrigger>
            <TabsTrigger value="explore">
              <Database />
              Explore the database
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <button className="data-badge" onClick={() => setAbout(true)}>
          <i />
          O*NET 31.0
          <Info size={14} />
        </button>
      </header>
      <div className="map-heading">
        <div className="eyebrow">
          {mode === 'career'
            ? 'YOUR CAREER CONSTELLATION'
            : 'THE WORLD OF WORK'}
        </div>
        <h1>
          {mode === 'career'
            ? 'See where you could go.'
            : 'Follow the connections.'}
        </h1>
        <p>
          {mode === 'career'
            ? 'Your skills. A whole world of possibilities.'
            : '923 occupations, connected by what they do.'}
        </p>
      </div>
      <div className="map-toolbar">
        {isTree ? (
          <span className="tree-color-label">Core & branch: path quality</span>
        ) : (
          <>
            <span>Color by</span>
            <Tabs value={color} onValueChange={(v) => setColor(String(v))}>
              <TabsList className="color-switch">
                <TabsTrigger value="cluster">
                  <Layers />
                  Cluster
                </TabsTrigger>
                <TabsTrigger value="pay">
                  <DollarSign />
                  Pay
                </TabsTrigger>
                {mode === 'career' && (
                  <TabsTrigger value="quality">
                    <Compass />
                    Path quality
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </>
        )}
        {mode === 'career' && (
          <Tabs
            value={layout}
            onValueChange={(v) => {
              setLayout(String(v));
              setFocusIndex(0);
              setView({ x: 0, y: 0, k: 1 });
            }}
          >
            <TabsList className="color-switch">
              <TabsTrigger value="map">
                <Orbit />
                Map
              </TabsTrigger>
              <TabsTrigger value="tree">
                <GitBranch />
                Possibility tree
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <label className="ai-toggle" htmlFor="ai-map-toggle">
          <Switch
            id="ai-map-toggle"
            checked={aiOverlay}
            onCheckedChange={setAiOverlay}
            aria-label="Show AI exposure rings"
          />
          AI rings
        </label>
      </div>
      <aside
        className={`floating-panel ${collapsed ? 'collapsed' : ''}`}
        inert={collapsed ? true : undefined}
        aria-label={mode === 'career' ? 'Career profile' : 'Database filters'}
      >
        <div className="panel-heading">
          <span>
            {mode === 'career' ? (
              <Sparkles size={16} />
            ) : (
              <Database size={16} />
            )}{' '}
            {mode === 'career' ? 'Your starting point' : 'Explore occupations'}
          </span>
          <button
            className="icon-button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse left panel"
            aria-expanded={!collapsed}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        {mode === 'career' ? (
          <>
            <div className="bubble career-focus">
              <label htmlFor="show-all-paths">
                <span>Show all paths</span>
                <Switch
                  id="show-all-paths"
                  checked={showAllPaths}
                  onCheckedChange={setShowAllPaths}
                />
              </label>
              <p role="status" aria-live="polite">
                {focusPaths
                  ? `${visible.length} roles remain · ${hiddenCount} below your guardrails hidden · ${landscape.clusters.length} groups`
                  : showAllPaths
                    ? 'All paths are available for comparison, including weaker outcomes.'
                    : 'Add profile details to narrow and reorganize your map.'}
              </p>
              {focusPaths && (
                <p className="microcopy">
                  Unknown fit stays visible. Skill filtering needs 4 rated
                  skills and 20% coverage.
                </p>
              )}
            </div>
            <Bubble
              step="01 · YOUR EXPERIENCE"
              title="Start with what you know."
              subtitle="Add all the previous jobs you want to draw on."
              open={phase === 1}
              onOpenChange={(v) => setPhase(v ? 1 : 0)}
            >
              <JobPicker items={roleItems} values={roles} onChange={setRoles} />
              <p className="microcopy">
                {roles.length} previous {roles.length === 1 ? 'job' : 'jobs'} ·{' '}
                {compiled.filter((s) => s.sources.length).length} distinct
                suggested skills. Review them in your skills window before using
                them for matching.
              </p>
              <button
                className="primary-button"
                onClick={() => setSkillsOpen(true)}
              >
                Review combined skills
                <ArrowUpRight size={17} />
              </button>
              {!roles.length && (
                <div className="example-roles">
                  Try{' '}
                  <button
                    onClick={() =>
                      setRoles((ids) => [...new Set([...ids, '15-1252.00'])])
                    }
                  >
                    Software developer
                  </button>
                  <span>or</span>
                  <button
                    onClick={() =>
                      setRoles((ids) => [...new Set([...ids, '29-1141.00'])])
                    }
                  >
                    Registered nurse
                  </button>
                </div>
              )}
            </Bubble>
            <Bubble
              step="02 · YOUR WHOLE PICTURE"
              title="More than a job title."
              subtitle="Bring your education, interests, training, and abilities into the picture."
              open={phase === 5}
              onOpenChange={(v) => setPhase(v ? 5 : 0)}
            >
              <div className="field-label">Highest education level</div>
              <Select
                value={String(criteria.education)}
                onValueChange={(v) =>
                  setCriteria((c) => ({ ...c, education: Number(v) }))
                }
              >
                <SelectTrigger
                  className="full-select"
                  aria-label="Highest education level"
                >
                  <SelectValue>{EDUCATION[criteria.education]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION.map((label, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {BACKGROUND_FIELDS.map((field) => (
                <div key={field.key}>
                  <label
                    className="field-label"
                    htmlFor={`background-${field.key}`}
                  >
                    {field.label}
                  </label>
                  <div className="input-shell">
                    <input
                      id={`background-${field.key}`}
                      value={background[field.key]}
                      maxLength={500}
                      placeholder={field.placeholder}
                      onChange={(e) =>
                        setBackground((b) => ({
                          ...b,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
              <p className="microcopy">
                Interest keywords help order similar paths. School/provider and
                physical notes stay as personal context. Credentials and
                proficiency need your confirmation. Profile entries stay in this
                tab.
              </p>
              {backgroundSkills.length > 0 && (
                <div className="background-suggestions">
                  <div className="section-label">Skills to consider</div>
                  <p className="microcopy">
                    From roles related to your interests. Add only skills you
                    have, then adjust the suggested starting level.
                  </p>
                  {backgroundSkills.map((s) => (
                    <button
                      className="suggestion-row"
                      key={s.i}
                      onClick={() => {
                        setProfile((p) => ({ ...p, [s.i]: 3 }));
                        setSkillsOpen(true);
                      }}
                    >
                      <span>
                        {data?.skills[s.i].name}
                        <small>Related role: {s.role}</small>
                      </span>
                      <Plus size={14} />
                    </button>
                  ))}
                </div>
              )}
              <div className="field-label">
                Physical, athletic & cognitive abilities
              </div>
              <Picker
                items={abilityItems.filter(
                  (a) => abilities[a.id] === undefined,
                )}
                value={null}
                label="Add an ability to assess"
                placeholder="Stamina, strength, dexterity, reasoning…"
                onChange={(id) => {
                  if (id !== null) setAbilities((a) => ({ ...a, [id]: 3 }));
                }}
              />
              <div className="skill-list">
                {Object.entries(abilities).map(([id, level]) => (
                  <div className="skill-row" key={id}>
                    <div>
                      <label id={`ability-${id}`}>
                        {data?.abilities[Number(id)].name}
                      </label>
                      <span>{level.toFixed(1)}</span>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${data?.abilities[Number(id)].name}`}
                        onClick={() =>
                          setAbilities((a) => {
                            const next = { ...a };
                            delete next[id];
                            return next;
                          })
                        }
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <Slider
                      aria-labelledby={`ability-${id}`}
                      min={0}
                      max={7}
                      step={0.5}
                      value={[level]}
                      onValueChange={(v) =>
                        setAbilities((a) => ({
                          ...a,
                          [id]: Array.isArray(v) ? v[0] : v,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="microcopy">
                Optional self-ratings from 0–7, using your usual supports. Gaps
                flag demands to review; accommodations and the actual workplace
                can change those demands.
              </p>
              <button
                className="primary-button"
                onClick={() => setSkillsOpen(true)}
              >
                Continue to skills
                <ArrowUpRight size={16} />
              </button>
            </Bubble>
            <div className="bubble skills-summary">
              <div className="step-label">03 · YOUR SKILLS</div>
              <h2>Everything you bring.</h2>
              <div className="skills-counts">
                <strong>
                  {Object.keys(profile).length}
                  <span>rated skills</span>
                </strong>
                <strong>
                  {pendingSkills.length}
                  <span>to review</span>
                </strong>
              </div>
              <p className="microcopy">
                Skills from every previous job and your own additions, together
                in one window.
              </p>
              <button
                className="primary-button"
                onClick={() => setSkillsOpen(true)}
              >
                Open my skills
                <ArrowUpRight size={17} />
              </button>
              {hasProfile && (
                <button className="text-button" onClick={() => setPhase(3)}>
                  Explore my next chapter
                  <ChevronRight size={15} />
                </button>
              )}
            </div>
            <Bubble
              step="04 · YOUR NEXT CHAPTER"
              title="What could you unlock?"
              subtitle="Try adding a skill. Watch your alignment change."
              open={phase === 3}
              onOpenChange={(v) => setPhase(v ? 3 : 0)}
            >
              <Picker
                items={skillItems}
                value={planned}
                onChange={setPlanned}
                label="Skill to explore learning"
                placeholder="What if I learned…"
              />
              {planned !== null && (
                <div className="what-if">
                  <div className="label-value">
                    <span>Target level</span>
                    <strong>
                      {Math.max(profile[planned] ?? 0, plannedLevel).toFixed(1)}{' '}
                      / 7
                    </strong>
                  </div>
                  <Slider
                    aria-label="Hypothetical skill level"
                    min={profile[planned] ?? 0}
                    max={7}
                    step={0.5}
                    value={[Math.max(profile[planned] ?? 0, plannedLevel)]}
                    onValueChange={(v) =>
                      setPlannedLevel(Array.isArray(v) ? v[0] : v)
                    }
                  />
                  <p>
                    <TrendingUp size={15} />
                    <strong>{improved}</strong> roles gain 5+ alignment points
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setPlanned(null)}
                  >
                    Clear scenario
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="field-label">Preparation you’re open to</div>
              <Select
                value={String(zone)}
                onValueChange={(v) => setZone(Number(v))}
              >
                <SelectTrigger
                  className="full-select"
                  aria-label="Maximum preparation level"
                >
                  <SelectValue>
                    {zone ? `Up to Job Zone ${zone}` : 'All preparation levels'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All preparation levels</SelectItem>
                  {[1, 2, 3, 4, 5].map((z) => (
                    <SelectItem value={String(z)} key={z}>
                      Up to Job Zone {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="microcopy">
                Job Zones describe typical education, experience, and
                training—not eligibility.
              </p>
            </Bubble>
            <Bubble
              step="05 · YOUR GUARDRAILS"
              title="What makes a good next move?"
              subtitle="Set the thresholds used to narrow your career map."
              open={phase === 4}
              onOpenChange={(v) => setPhase(v ? 4 : 0)}
            >
              <label className="field-label" htmlFor="salary-target">
                Minimum annual pay target ($)
              </label>
              <div className="input-shell">
                <DollarSign size={15} />
                <input
                  id="salary-target"
                  type="number"
                  min="0"
                  max="1000000"
                  step="5000"
                  value={criteria.payFloor}
                  onChange={(e) =>
                    setCriteria((c) => ({
                      ...c,
                      payFloor: Math.max(
                        0,
                        Math.min(1000000, Number(e.target.value) || 0),
                      ),
                    }))
                  }
                />
              </div>
              <div className="criteria-range">
                <div className="label-value">
                  <span id="fit-label">Minimum skill alignment</span>
                  <strong>{criteria.minFit}/100</strong>
                </div>
                <Slider
                  aria-labelledby="fit-label"
                  min={40}
                  max={100}
                  step={5}
                  value={[criteria.minFit]}
                  onValueChange={(v) =>
                    setCriteria((c) => ({
                      ...c,
                      minFit: Array.isArray(v) ? v[0] : v,
                    }))
                  }
                />
              </div>
              <div className="criteria-grid">
                <div>
                  <label className="field-label" htmlFor="growth-target">
                    Min. growth (%)
                  </label>
                  <div className="input-shell">
                    <input
                      id="growth-target"
                      type="number"
                      min="-100"
                      max="100"
                      value={criteria.minGrowth}
                      onChange={(e) =>
                        setCriteria((c) => ({
                          ...c,
                          minGrowth: Math.max(
                            -100,
                            Math.min(100, Number(e.target.value) || 0),
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="field-label" htmlFor="openings-target">
                    Min. openings / yr
                  </label>
                  <div className="input-shell">
                    <input
                      id="openings-target"
                      type="number"
                      min="0"
                      max="1000000"
                      step="100"
                      value={criteria.minOpenings}
                      onChange={(e) =>
                        setCriteria((c) => ({
                          ...c,
                          minOpenings: Math.max(
                            0,
                            Math.min(1000000, Number(e.target.value) || 0),
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              <p className="microcopy">
                National openings and growth indicate market demand, not your
                personal hiring probability. Pay uses the selected percentile.
              </p>
              <button
                className="primary-button"
                onClick={() => setColor('quality')}
              >
                Show my outcome landscape
                <Compass size={16} />
              </button>
            </Bubble>
            {hasDetails && (
              <div className="bubble matches-bubble">
                <div className="section-label">
                  <Sparkles size={14} />
                  Possibilities to explore<span>{visible.length}</span>
                </div>
                <p className="microcopy">
                  Ranked by your guardrails, skill alignment, then interest
                  overlap.
                </p>
                {ranked.slice(0, 5).map((o) => (
                  <button
                    className="result-row"
                    key={o.id}
                    onClick={() => roleSelect(o.id)}
                  >
                    <i style={{ background: COLORS[o.cluster] }} />
                    <span>
                      {o.title}
                      <small>
                        {money(wageAt(o, percentile, unit), true, unit)}
                        {wageAt(o, percentile, unit)
                          ? unit === 'annual'
                            ? ' / yr'
                            : ' / hr'
                          : ''}
                      </small>
                      <small
                        style={{
                          color: QUALITY[quality.get(o.id)!.status].color,
                        }}
                      >
                        {QUALITY[quality.get(o.id)!.status].label}
                      </small>
                      {aiOverlay && (
                        <small className="ai-text">
                          {aiLabel(o, aiMetric)}
                        </small>
                      )}
                    </span>
                    <strong>
                      {scores.get(o.id)?.score ?? '—'}
                      <small>/100</small>
                    </strong>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="bubble">
              <div className="step-label">FIND YOUR CURIOSITY</div>
              <h2>Every role has a story.</h2>
              <div className="cluster-basis">
                <span id="cluster-basis-label">Group occupations by</span>
                <Tabs
                  value={clusterBy}
                  onValueChange={(v) => {
                    setClusterBy(v as ClusterBasis);
                    setCluster(null);
                    setHovered(null);
                    setFocusIndex(0);
                    setView({ x: 0, y: 0, k: 1 });
                  }}
                >
                  <TabsList aria-labelledby="cluster-basis-label">
                    <TabsTrigger value="skills">
                      <Sparkles size={14} />
                      Skills
                    </TabsTrigger>
                    <TabsTrigger value="activities">
                      <Layers size={14} />
                      Activities
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p>
                  {basis === 'skills'
                    ? 'Similar required skill levels and importance, across occupations.'
                    : 'Similar tasks and responsibilities, using detailed work activities.'}
                </p>
              </div>
              <label className="input-shell">
                <Search size={17} />
                <input
                  aria-label="Search occupations or tasks"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Title, alias, typo, code, or task…"
                  maxLength={160}
                />
                {query && (
                  <button
                    className="icon-button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <div className="filter-heading">
                <span>
                  {basis === 'skills'
                    ? 'Skill-profile clusters'
                    : 'Work-activity clusters'}
                </span>
                {cluster !== null && (
                  <button onClick={() => setCluster(null)}>Clear</button>
                )}
              </div>
              <div className="cluster-filters">
                {activeClusters.map((c) => (
                  <button
                    key={c.id}
                    className={cluster === c.id ? 'active' : ''}
                    onClick={() => setCluster(cluster === c.id ? null : c.id)}
                    aria-pressed={cluster === c.id}
                    title={c.features.join(' · ')}
                  >
                    <i style={{ background: COLORS[c.id] }} />
                    <span className="cluster-name">{clusterNames[c.id]}</span>
                    <span>{c.count}</span>
                  </button>
                ))}
              </div>
              {selectedCluster && (
                <div className="cluster-evidence">
                  <h3>
                    {basis === 'skills'
                      ? 'Group skill dimensions'
                      : 'Common work activities'}
                  </h3>
                  <ul>
                    {selectedCluster.features.map((feature, i) => (
                      <li key={feature}>
                        {feature}
                        {basis === 'skills' && selectedCluster.meanLevels && (
                          <span>
                            {' '}
                            {selectedCluster.meanLevels[i].toFixed(1)}/7 mean
                            level
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p>
                    {basis === 'skills'
                      ? selectedCluster.featureBasis === 'reported-level'
                        ? 'This group has lower skill demands overall. Shown are its highest reported mean levels.'
                        : 'Dimensions with the highest relative demand in this group. Means use reported levels.'
                      : 'Representative activities from the group’s original task profiles.'}
                  </p>
                </div>
              )}
            </div>
            <div className="bubble matches-bubble">
              <div className="section-label">
                {visible.length} occupations
                <span>P{PERCENTILES[percentile]} pay</span>
              </div>
              {ranked.slice(0, 40).map((o) => (
                <button
                  className="result-row"
                  key={o.id}
                  onClick={() => roleSelect(o.id)}
                >
                  <i style={{ background: COLORS[o.cluster] }} />
                  <span>
                    {o.title}
                    <small>{o.id}</small>
                  </span>
                  <strong>
                    {money(wageAt(o, percentile, unit), true, unit)}
                  </strong>
                </button>
              ))}
              {visible.length > 40 && (
                <p className="microcopy">
                  Showing the first 40. Refine your search or choose a dot on
                  the map.
                </p>
              )}
              {!visible.length && (
                <p className="empty-hint">
                  No close titles or tasks match. Try a shorter phrase or clear
                  your filters.
                </p>
              )}
            </div>
          </>
        )}
        <Bubble
          step="AI · EXPOSURE LENS"
          title="Where does AI overlap?"
          subtitle="Red marks exposure to AI. The center keeps your career fit visible."
          open={phase === 6}
          onOpenChange={(v) => setPhase(v ? 6 : 0)}
        >
          <label className="ai-toggle" htmlFor="ai-panel-toggle">
            <Switch
              id="ai-panel-toggle"
              checked={aiOverlay}
              onCheckedChange={setAiOverlay}
              aria-label="Enable AI overlay"
            />
            Show exposure rings
          </label>
          <div className="field-label">Published measure</div>
          <Select
            value={aiMetric}
            onValueChange={(v) => setAiMetric(v as AIMetric)}
          >
            <SelectTrigger
              className="full-select"
              aria-label="AI exposure dataset"
            >
              <SelectValue>{AI_SOURCES[aiMetric].name}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(AI_SOURCES).map(([id, source]) => (
                <SelectItem value={id} key={id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="microcopy">
            {AI_SOURCES[aiMetric].date} · {AI_SOURCES[aiMetric].description}
          </p>
          <div className="criteria-range">
            <div className="label-value">
              <span id="ai-threshold">Highlight from index</span>
              <strong>{aiThreshold}/100</strong>
            </div>
            <Slider
              aria-labelledby="ai-threshold"
              min={0}
              max={100}
              step={5}
              value={[aiThreshold]}
              onValueChange={(v) => setAiThreshold(Array.isArray(v) ? v[0] : v)}
            />
          </div>
          <p className="microcopy">
            Your comparison threshold, not a research-defined danger cutoff. It
            highlights rings without changing career scores.
          </p>
          {mode === 'career' && (
            <div className="ai-overlap-summary" aria-live="polite">
              <strong>
                {exposedPaths}{' '}
                <small>
                  of {strongPaths.length} strong paths at or above this AI index
                </small>
              </strong>
              <span>
                {unknownAIPaths} strong paths have no score from this source.
              </span>
            </div>
          )}
          <p className="microcopy">
            A larger red arc means a higher index. Zero means zero measured
            exposure; a dashed ring means missing data. These scores do not give
            a probability of job loss.
          </p>
          <a
            className="source-link"
            href={AI_SOURCES[aiMetric].source}
            target="_blank"
            rel="noreferrer"
          >
            Read the study
            <ExternalLink size={12} />
          </a>
          <button className="text-button" onClick={() => setAbout(true)}>
            Compare sources & limitations
            <ChevronRight size={14} />
          </button>
        </Bubble>
      </aside>
      {collapsed && (
        <button
          className="reopen bubble"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
        >
          <Sparkles size={16} />
          {mode === 'career' ? 'Your profile' : 'Filters'}
          <ChevronRight size={15} />
        </button>
      )}
      <section
        className={`map-stage ${isTree ? 'tree-stage' : ''}`}
        aria-label="Interactive occupation map"
      >
        {data && (
          <div className="map-caption">
            {isTree
              ? `${mapOccupations.length} example paths across ${branches.length} clusters · grouping, not a hiring forecast`
              : focusPaths
                ? 'Your remaining paths · activity groups resized and repacked to fit'
                : basis === 'skills'
                  ? 'Grouped by skill profiles · nearby roles need similar skills'
                  : 'Grouped by activities · nearby roles share responsibilities'}
            {aiOverlay && (
              <button
                onClick={() => {
                  setCollapsed(false);
                  setPhase(6);
                }}
              >
                <ShieldAlert size={12} />
                {AI_SOURCES[aiMetric].name} · red arcs
                <ChevronRight size={12} />
              </button>
            )}
          </div>
        )}
        {error ? (
          <div className="map-message">
            <Info />
            <h2>Couldn’t load the map</h2>
            <p>{error}</p>
            <button
              className="primary-button"
              onClick={() => location.reload()}
            >
              Try again
            </button>
          </div>
        ) : !data ? (
          <div className="map-message">
            <LoaderCircle className="loading-spin" />
            <p>Connecting the world of work…</p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox="0 0 1200 800"
            aria-label="Career constellation. Use arrow keys between occupations and Enter to inspect."
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                vx: view.x,
                vy: view.y,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const m = e.currentTarget.getScreenCTM();
              const scale = m?.a ?? 1;
              const origin = drag.current;
              setView((v) => ({
                ...v,
                x: origin.vx + (e.clientX - origin.x) / scale,
                y: origin.vy + (e.clientY - origin.y) / scale,
              }));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <defs>
              <filter
                id="node-glow"
                x="-200%"
                y="-200%"
                width="500%"
                height="500%"
              >
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              <g className="connections" aria-hidden="true">
                {!isTree &&
                  visible.flatMap((o) =>
                    o.neighbors
                      .slice(0, 2)
                      .filter(
                        ([id, sim]) =>
                          id > o.id && sim > 0.13 && mapById.has(id),
                      )
                      .map(([id]) => {
                        const target = mapById.get(id)!;
                        const a = point(o),
                          b = point(target);
                        return (
                          <line
                            key={o.id + id}
                            x1={a.x}
                            y1={a.y}
                            x2={b.x}
                            y2={b.y}
                            stroke={COLORS[o.cluster]}
                            strokeWidth={0.65 / view.k}
                            opacity={
                              hovered === o.id || hovered === id ? 0.65 : 0.12
                            }
                          />
                        );
                      }),
                  )}
              </g>
              {!isTree &&
                landscape.clusters.map((c) => {
                  const p = point(c);
                  return (
                    <g
                      key={c.id}
                      className="cluster-label"
                      style={{ transform: `translate(${p.x}px,${p.y - 35}px)` }}
                      aria-hidden="true"
                    >
                      <text
                        textAnchor="middle"
                        fill={COLORS[c.id]}
                        style={{ fontSize: `${12 / Math.sqrt(view.k)}px` }}
                      >
                        {c.name.split(' · ').map((part, i) => (
                          <tspan
                            key={part}
                            x={0}
                            dy={i ? 15 / Math.sqrt(view.k) : 0}
                          >
                            {part}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  );
                })}
              {isTree && (
                <g className="tree-branches" aria-hidden="true">
                  <circle
                    cx={100}
                    cy={390}
                    r={28}
                    fill="#282439"
                    stroke="#aa95d0"
                  />
                  <text
                    x={100}
                    y={445}
                    textAnchor="middle"
                    fill="#e7def4"
                    fontSize={18}
                  >
                    Your profile
                  </text>
                  <text
                    x={100}
                    y={467}
                    textAnchor="middle"
                    fill="#a099b1"
                    fontSize={12}
                  >
                    {Object.keys(profile).length} skills rated
                  </text>
                  {branches.map((b, bi) => {
                    const y = 148 + bi * 175;
                    return (
                      <g key={b.id}>
                        <path
                          d={`M128 390 C220 390 210 ${y} 325 ${y}`}
                          fill="none"
                          stroke={COLORS[b.id]}
                          strokeWidth={1.4}
                          opacity={0.35}
                        />
                        <circle cx={325} cy={y} r={7} fill={COLORS[b.id]} />
                        <text
                          x={325}
                          y={y - 33}
                          textAnchor="middle"
                          fill={COLORS[b.id]}
                          fontSize={15}
                        >
                          {clusterNames[b.id]}
                        </text>
                        {b.roles.map((o) => {
                          const p = treePositions.get(o.id)!;
                          const path = `M333 ${y} C435 ${y} 500 ${p.y} ${p.x - 12} ${p.y}`;
                          const ai = aiValue(o, aiMetric);
                          return (
                            <g key={o.id}>
                              <path
                                d={path}
                                fill="none"
                                stroke={
                                  QUALITY[quality.get(o.id)!.status].color
                                }
                                strokeWidth={2.4}
                                opacity={0.6}
                              />
                              {aiOverlay && ai !== null && (
                                <path
                                  d={path}
                                  fill="none"
                                  stroke="#e34264"
                                  strokeWidth={3}
                                  pathLength={100}
                                  strokeDasharray={`0 ${100 - ai * 100} ${ai * 100} 0`}
                                  opacity={ai * 100 >= aiThreshold ? 0.85 : 0.4}
                                />
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              )}
              {mapOccupations.map((o, i) => {
                const position = isTree ? treePositions.get(o.id)! : point(o);
                const p = { x: 0, y: 0 };
                const score = scores.get(o.id)?.score ?? 0;
                const missingSkills =
                  basis === 'skills' && o.imputedMeasurements === 70;
                const bright =
                  mode === 'career' && hasProfile && color !== 'quality';
                const active = selected === o.id || hovered === o.id;
                const fill = isTree
                  ? QUALITY[quality.get(o.id)!.status].color
                  : color === 'pay'
                    ? payColor(wageAt(o, percentile, unit), unit)
                    : color === 'quality'
                      ? QUALITY[quality.get(o.id)!.status].color
                      : COLORS[o.cluster];
                const opacity = bright
                  ? scores.get(o.id)?.score == null
                    ? 0.5
                    : 0.3 + 0.7 * (score / 100) ** 3
                  : 0.8;
                return (
                  <g
                    key={o.id}
                    data-occupation={o.id}
                    role="button"
                    tabIndex={
                      Math.min(focusIndex, mapOccupations.length - 1) === i
                        ? 0
                        : -1
                    }
                    aria-label={`${o.title}, ${QUALITY[quality.get(o.id)!.status].label}, ${money(wageAt(o, percentile, unit), false, unit)} at percentile ${PERCENTILES[percentile]}${aiOverlay ? `, ${aiLabel(o, aiMetric)}` : ''}`}
                    className="occupation-node"
                    onFocus={() => {
                      setFocusIndex(i);
                      setHovered(o.id);
                    }}
                    onBlur={() => setHovered(null)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseEnter={() => setHovered(o.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => roleSelect(o.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        roleSelect(o.id);
                      } else if (e.key.startsWith('Arrow')) {
                        e.preventDefault();
                        const next =
                          (i +
                            (e.key === 'ArrowRight' || e.key === 'ArrowDown'
                              ? 1
                              : -1) +
                            mapOccupations.length) %
                          mapOccupations.length;
                        setFocusIndex(next);
                        (
                          svgRef.current?.querySelector(
                            `[data-occupation="${mapOccupations[next].id}"]`,
                          ) as SVGGElement
                        )?.focus();
                      }
                    }}
                    style={{
                      transform: `translate(${position.x}px,${position.y}px)`,
                    }}
                  >
                    <title>
                      {o.title}
                      {missingSkills
                        ? ' · No reported skill measurements; position imputed'
                        : ''}
                      {aiOverlay ? ` · ${aiLabel(o, aiMetric)}` : ''}
                    </title>
                    {aiOverlay && (
                      <ExposureRing
                        x={p.x}
                        y={p.y}
                        radius={(isTree ? 10 : 6.8) / Math.sqrt(view.k)}
                        value={aiValue(o, aiMetric)}
                        threshold={aiThreshold}
                      />
                    )}
                    {(active || (bright && score >= 90)) && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={active ? 12 : 8}
                        fill={fill}
                        opacity={active ? 0.55 : 0.23}
                        filter="url(#node-glow)"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={9 / view.k}
                      fill="transparent"
                    />
                    <circle
                      className="node-core"
                      cx={p.x}
                      cy={p.y}
                      r={(active ? 5.5 : 3.1) / Math.sqrt(view.k)}
                      fill={missingSkills ? 'none' : fill}
                      stroke={missingSkills ? '#aaa4b9' : undefined}
                      strokeWidth={
                        missingSkills ? 1.5 / Math.sqrt(view.k) : undefined
                      }
                      opacity={isTree ? 1 : opacity}
                    />
                    {isTree && (
                      <>
                        <text
                          x={p.x + 24}
                          y={p.y - 3}
                          fill="#eee7f3"
                          fontSize={16}
                        >
                          {o.title.length > 48
                            ? `${o.title.slice(0, 47)}…`
                            : o.title}
                        </text>
                        <text
                          x={p.x + 24}
                          y={p.y + 17}
                          fill={QUALITY[quality.get(o.id)!.status].color}
                          fontSize={12}
                        >
                          {QUALITY[quality.get(o.id)!.status].label} ·{' '}
                          {money(wageAt(o, percentile, unit), true, unit)}
                          {aiOverlay
                            ? ` · AI ${aiValue(o, aiMetric) === null ? '—' : `${(aiValue(o, aiMetric)! * 100).toFixed(1)}/100`}`
                            : ''}
                        </text>
                      </>
                    )}
                    {active && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={10 / Math.sqrt(view.k)}
                        fill="none"
                        stroke={fill}
                        strokeWidth={1 / view.k}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        {!visible.length && data && (
          <div className="map-empty">
            {focusPaths
              ? 'No roles meet your current guardrails and filters.'
              : 'No matching occupations'}
            {focusPaths && (
              <button
                onClick={() => {
                  setCollapsed(false);
                  setPhase(4);
                }}
              >
                Adjust guardrails
              </button>
            )}
            <button
              onClick={() => {
                reset();
                setZone(0);
                if (focusPaths) setShowAllPaths(true);
              }}
            >
              {focusPaths ? 'Show all paths' : 'Clear filters'}
            </button>
          </div>
        )}
      </section>
      {hover && (
        <div className="hover-card bubble" role="status">
          <div className="step-label" style={{ color: COLORS[hover.cluster] }}>
            {clusterNames[hover.cluster]}
          </div>
          <strong>{hover.title}</strong>
          {basis === 'skills' && !!hover.imputedMeasurements && (
            <small>
              {70 - hover.imputedMeasurements}/70 skill measurements reported ·
              missing values imputed for placement
            </small>
          )}
          {aiOverlay && (
            <span className="ai-text">{aiLabel(hover, aiMetric)}</span>
          )}
          {mode === 'career' && (
            <span
              className="quality-badge"
              style={{ color: QUALITY[quality.get(hover.id)!.status].color }}
            >
              {QUALITY[quality.get(hover.id)!.status].label}
            </span>
          )}
          <div>
            <span>
              {money(wageAt(hover, percentile, unit), false, unit)}
              <small>
                {wageAt(hover, percentile, unit)
                  ? unit === 'annual'
                    ? ' / year'
                    : ' / hour'
                  : ''}
              </small>
            </span>
            <small>P{PERCENTILES[percentile]} · US</small>
          </div>
          {mode === 'career' && hasProfile && (
            <p>
              {scores.get(hover.id)?.score ?? '—'}/100 alignment ·{' '}
              {scores.get(hover.id)?.coverage}% of skill importance rated
            </p>
          )}
          <small>
            Click to explore this occupation
            <ArrowUpRight size={13} />
          </small>
        </div>
      )}
      <div className="map-controls bubble">
        <button
          className="icon-button"
          onClick={() => zoom(1.25)}
          aria-label="Zoom in"
        >
          <Plus size={18} />
        </button>
        <span>{Math.round(view.k * 100)}%</span>
        <button
          className="icon-button"
          onClick={() => zoom(0.8)}
          aria-label="Zoom out"
        >
          <Minus size={18} />
        </button>
        <div className="control-divider" />
        <button
          className="icon-button"
          onClick={() => setView({ x: 0, y: 0, k: 1 })}
          aria-label="Reset map position"
        >
          <Scan size={18} />
        </button>
      </div>
      <div className="pay-dock bubble">
        <div className="pay-dock-title">
          <div className="pay-icon">
            <TrendingUp size={18} />
          </div>
          <div>
            <strong>Explore earning potential</strong>
            <span>US wage distribution · BLS 2025</span>
          </div>
          <Select
            value={unit}
            onValueChange={(v) => setUnit(v as 'annual' | 'hourly')}
          >
            <SelectTrigger aria-label="Wage unit" className="unit-select">
              <SelectValue>
                {unit === 'annual' ? 'Annual' : 'Hourly'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
            </SelectContent>
          </Select>
          <span className="percentile-badge">P{PERCENTILES[percentile]}</span>
        </div>
        <Slider
          aria-label="Wage percentile"
          min={0}
          max={4}
          step={1}
          value={[percentile]}
          onValueChange={(v) => setPercentile(Array.isArray(v) ? v[0] : v)}
          aria-valuetext={`${PERCENTILES[percentile]}th percentile`}
        />
        <div className="percentile-labels">
          {PERCENTILES.map((p, i) => (
            <button
              key={p}
              className={percentile === i ? 'active' : ''}
              onClick={() => setPercentile(i)}
              aria-label={`${p}th wage percentile`}
            >
              {p === 50 ? '50th · Median' : `${p}th`}
            </button>
          ))}
        </div>
        <div className="pay-dock-bottom">
          <span>Wages, not total compensation or an earnings forecast.</span>
          <button
            onClick={() => {
              setLayout('map');
              setColor(color === 'pay' ? 'cluster' : 'pay');
            }}
          >
            {color === 'pay' ? <Check size={12} /> : <Layers size={12} />}Pay on
            map
          </button>
        </div>
      </div>
      <div className="map-legend">
        {color === 'quality' || isTree ? (
          Object.entries(QUALITY)
            .filter(([key]) => !focusPaths || key !== 'below')
            .map(([key, q]) => (
              <span className="quality-legend-item" key={key}>
                <i style={{ background: q.color }} />
                {q.label}
              </span>
            ))
        ) : color === 'pay' ? (
          <>
            <span>Lower pay</span>
            <i className="pay-gradient" />
            <span>Higher pay</span>
            <span className="unknown-dot" />
            Not reported
          </>
        ) : mode === 'career' && hasProfile ? (
          <>
            <span className="legend-ring" />
            {focusPaths
              ? 'Uncertain or near your minimum'
              : 'Unknown or lower alignment'}
            <span className="legend-glow" />
            Higher alignment
          </>
        ) : (
          <>
            <span className="legend-dot" />
            One dot, one occupation
            <span className="legend-line" />
            {basis === 'skills'
              ? 'Similar skill profiles'
              : 'Shared responsibilities'}
          </>
        )}
        {mode === 'explore' && basis === 'skills' && (
          <span>Hollow center = no reported skill data</span>
        )}
        {aiOverlay && (
          <span className="ai-legend">
            <i />
            Red arc = AI index · dashed = unavailable
          </span>
        )}
      </div>
      <footer>
        <span>
          <i className="live-dot" />
          {data
            ? `${visible.length.toLocaleString()} occupations`
            : 'Loading occupations'}
          <span className="footer-sep">/</span>
          <button onClick={() => setAbout(true)}>
            Data & methodology
            <ArrowUpRight size={12} />
          </button>
        </span>
        <span>Scroll to zoom · Drag to explore · Click to discover</span>
        <button
          className="mobile-info"
          onClick={() => setAbout(true)}
          aria-label="Data and methodology"
        >
          <Info size={16} />
        </button>
      </footer>
      <Dialog open={skillsOpen} onOpenChange={setSkillsOpen}>
        <DialogContent className="skills-window">
          <div className="skills-window-header">
            <div className="eyebrow">YOUR COMBINED SKILL LIBRARY</div>
            <DialogTitle>All your skills. One place.</DialogTitle>
            <DialogDescription>
              {roles.length} previous {roles.length === 1 ? 'job' : 'jobs'} ·{' '}
              {Object.keys(profile).length} rated · {pendingSkills.length}{' '}
              suggested. Check or rate a suggested skill to include it in career
              matching.
            </DialogDescription>
          </div>
          <div className="skills-workspace">
            <section className="compiled-skills" aria-label="Compiled skills">
              <div className="skills-section-heading">
                <h3>
                  Compiled skills <span>{compiled.length}</span>
                </h3>
                {!!pendingSkills.length && (
                  <button
                    className="text-button"
                    onClick={() =>
                      setProfile((p) => ({
                        ...Object.fromEntries(
                          pendingSkills.map((s) => [s.id, s.level]),
                        ),
                        ...p,
                      }))
                    }
                  >
                    Use all suggested levels
                    <Check size={14} />
                  </button>
                )}
              </div>
              {!!pendingSkills.length && (
                <p className="skills-note">
                  Job suggestions use the highest reported level across your
                  jobs, never a sum. Adjust them to reflect your own experience.
                </p>
              )}
              {!compiled.length && (
                <div className="skills-empty">
                  <Sparkles size={28} />
                  <h3>Start building your skill library.</h3>
                  <p>
                    Choose skills in “Add skills” or add previous jobs to
                    compile their suggestions here.
                  </p>
                </div>
              )}
              <div className="compiled-skill-list">
                {compiled.map((skill) => (
                  <article
                    className={`compiled-skill ${skill.confirmed ? 'is-rated' : ''}`}
                    key={skill.id}
                  >
                    <div className="compiled-skill-heading">
                      <Checkbox
                        id={`use-skill-${skill.id}`}
                        checked={skill.confirmed}
                        aria-label={`Use ${skill.name} for matching`}
                        onCheckedChange={(checked) =>
                          setProfile((p) => {
                            const next = { ...p };
                            if (checked) next[skill.id] = skill.level;
                            else delete next[skill.id];
                            return next;
                          })
                        }
                      />
                      <label htmlFor={`use-skill-${skill.id}`}>
                        {skill.name}
                      </label>
                      <span
                        className={
                          skill.confirmed ? 'rated-label' : 'suggested-label'
                        }
                      >
                        {skill.confirmed ? 'Rated' : 'Suggested'}
                      </span>
                      <strong>
                        {skill.level.toFixed(1)}
                        <small> / 7</small>
                      </strong>
                    </div>
                    <Slider
                      aria-label={`${skill.name} level`}
                      min={0}
                      max={7}
                      step={0.5}
                      value={[skill.level]}
                      onValueChange={(v) =>
                        setProfile((p) => ({
                          ...p,
                          [skill.id]: Array.isArray(v) ? v[0] : v,
                        }))
                      }
                    />
                    <div className="skill-sources">
                      {skill.sources.length ? (
                        skill.sources.map((source) => (
                          <span key={source.id}>
                            {source.title} <b>{source.level.toFixed(1)}</b>
                          </span>
                        ))
                      ) : (
                        <span>Your own addition</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className="skill-catalog" aria-label="Add multiple skills">
              <h3>Add skills</h3>
              <p className="skills-note">
                Choose several, then add them together. New ratings start at 3/7
                for you to adjust.
              </p>
              <div className="input-shell">
                <Search size={16} />
                <input
                  aria-label="Search skills to add"
                  value={skillQuery}
                  maxLength={160}
                  placeholder="Find a skill…"
                  onChange={(e) => setSkillQuery(e.target.value)}
                />
              </div>
              <div className="skill-catalog-list">
                {availableSkills.map((skill) => (
                  <label
                    className="catalog-skill"
                    key={skill.id}
                    htmlFor={`add-skill-${skill.id}`}
                  >
                    <Checkbox
                      id={`add-skill-${skill.id}`}
                      checked={skillDraft.includes(skill.id)}
                      onCheckedChange={(checked) =>
                        setSkillDraft((ids) =>
                          checked
                            ? [...new Set([...ids, skill.id])]
                            : ids.filter((id) => id !== skill.id),
                        )
                      }
                    />
                    {skill.name}
                  </label>
                ))}
                {!availableSkills.length && (
                  <p className="skills-note">
                    {skillQuery
                      ? 'No unselected skills match this search.'
                      : 'All available skills are already rated.'}
                  </p>
                )}
              </div>
              <button
                className="primary-button"
                disabled={!skillDraft.some((id) => profile[id] === undefined)}
                onClick={addSkills}
              >
                Add{' '}
                {skillDraft.filter((id) => profile[id] === undefined).length ||
                  ''}{' '}
                selected skills
                <Plus size={16} />
              </button>
              {!!skillDraft.length && (
                <button
                  className="text-button"
                  onClick={() => setSkillDraft([])}
                >
                  Clear selection
                </button>
              )}
            </section>
          </div>
          <div className="skills-window-footer">
            <p>
              {planned !== null
                ? `Learning scenario: ${data?.skills[Number(planned)].name} at ${Math.max(profile[planned] ?? 0, plannedLevel).toFixed(1)}/7. Kept separate from your current ratings.`
                : 'Your ratings update the career map as you edit. Unrated suggestions stay unknown.'}
            </p>
            <button
              className="primary-button"
              onClick={() => setSkillsOpen(false)}
            >
              Done
              <Check size={16} />
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      >
        <SheetContent className="detail-sheet">
          {detail && (
            <>
              <div className="detail-top">
                <span
                  className="detail-cluster"
                  style={{ color: COLORS[detail.cluster] }}
                >
                  <i style={{ background: COLORS[detail.cluster] }} />
                  {clusterNames[detail.cluster]}
                </span>
                <SheetTitle className="detail-title">{detail.title}</SheetTitle>
                <SheetDescription className="detail-description">
                  {detail.description}
                </SheetDescription>
                <div className="detail-meta">
                  <span>{detail.id}</span>
                  <span>
                    {detail.zone
                      ? `Job Zone ${detail.zone} / 5`
                      : 'Preparation not reported'}
                  </span>
                </div>
              </div>
              <div className="detail-section ai-detail">
                <div className="section-label">
                  <ShieldAlert size={14} />
                  AI exposure & applicability
                </div>
                {(['observed', 'applicability'] as AIMetric[]).map((metric) => {
                  const v = aiValue(detail, metric),
                    source = AI_SOURCES[metric];
                  return (
                    <div className="ai-measure" key={metric}>
                      <div className="label-value">
                        <span>{source.name}</span>
                        <strong>
                          {v === null
                            ? 'Not reported'
                            : `${(v * 100).toFixed(1)} / 100`}
                        </strong>
                      </div>
                      <div
                        className="ai-meter"
                        role="img"
                        aria-label={aiLabel(detail, metric)}
                      >
                        <i style={{ width: `${(v ?? 0) * 100}%` }} />
                      </div>
                      <p className="microcopy">
                        {source.date} · {source.description}
                      </p>
                      <a
                        className="source-link"
                        href={source.source}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {metric === 'observed'
                          ? 'Anthropic · Massenkoff & McCrory'
                          : 'Microsoft · Tomlinson et al.'}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  );
                })}
                <p className="microcopy">
                  Scores are separate indices with different definitions, not
                  comparable percentages of jobs lost. Inherited SOC group:{' '}
                  {detail.ai?.soc ?? 'unavailable'} ·{' '}
                  {detail.ai?.observedTitle ??
                    detail.ai?.applicabilityTitle ??
                    'No matched group'}
                  . Specialized roles share their group’s score.
                </p>
                <div className="section-label">
                  Latest usage snapshot<span>May 2026</span>
                </div>
                <p className="microcopy">
                  Anthropic’s June 26, 2026 release · global Claude chat and
                  Cowork use linked to this occupation’s tasks.
                </p>
                <div className="outlook-grid">
                  <div>
                    <strong>
                      {detail.ai?.usage?.collaboration_bucket_automation_pct ==
                      null
                        ? '—'
                        : `${detail.ai.usage.collaboration_bucket_automation_pct.toFixed(1)}%`}
                    </strong>
                    <span>Automation usage</span>
                  </div>
                  <div>
                    <strong>
                      {detail.ai?.usage
                        ?.collaboration_bucket_augmentation_pct == null
                        ? '—'
                        : `${detail.ai.usage.collaboration_bucket_augmentation_pct.toFixed(1)}%`}
                    </strong>
                    <span>Augmentative usage</span>
                  </div>
                </div>
                <p className="microcopy">
                  Shares of measured AI interactions for these tasks, not shares
                  of workers or all work. Unpublished cells stay unknown. This
                  snapshot does not update the March exposure index.
                </p>
                <a
                  className="source-link"
                  href="https://www.anthropic.com/research/economic-index-june-2026-report"
                  target="_blank"
                  rel="noreferrer"
                >
                  June 2026 Economic Index
                  <ExternalLink size={12} />
                </a>
              </div>
              {(Object.values(background).some(Boolean) ||
                Object.keys(abilities).length > 0) && (
                <div className="detail-section">
                  <div className="section-label">
                    Your background connections
                  </div>
                  <p className="microcopy">
                    {overlaps.get(detail.id)?.length
                      ? `Shared interest keywords: ${overlaps.get(detail.id)!.join(', ')}. This is interest affinity, not verified proficiency.`
                      : 'No direct interest keyword overlap with this role. Your rated skills still determine alignment.'}
                  </p>
                  {background.source && (
                    <p className="microcopy">
                      Education source: {background.source}
                      {background.major ? ` · ${background.major}` : ''}. Source
                      prestige is not scored.
                    </p>
                  )}
                  {background.physical && (
                    <p className="microcopy">
                      Your physical capability / support notes:{' '}
                      {background.physical}
                    </p>
                  )}
                  {Object.entries(abilities).map(([id, level]) => (
                    <div className="ability-comparison" key={id}>
                      <span>{data?.abilities[Number(id)].name}</span>
                      <span>
                        You {level}/7 · Role{' '}
                        {detail.abilities?.[Number(id)] ?? '—'}/7
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!!detail.aliases?.length && (
                <details className="detail-section alias-details">
                  <summary>
                    {detail.aliases.length} alternate job titles
                  </summary>
                  <p className="microcopy">{detail.aliases.join(' · ')}</p>
                </details>
              )}
              <div className="detail-section outcome-section">
                <div className="section-label">
                  Your outcome assessment
                  <span
                    className="quality-badge"
                    style={{
                      color: QUALITY[quality.get(detail.id)!.status].color,
                    }}
                  >
                    {QUALITY[quality.get(detail.id)!.status].label}
                  </span>
                </div>
                <ul className="outcome-reasons">
                  {[
                    ...quality.get(detail.id)!.reasons,
                    ...quality.get(detail.id)!.unknown,
                    ...quality.get(detail.id)!.cautions,
                  ].map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                  {quality.get(detail.id)!.status === 'strong' && (
                    <li>
                      Meets your current skill, pay, preparation, growth, and
                      openings thresholds.
                    </li>
                  )}
                </ul>
                <p className="microcopy">
                  Relative to your preferences, not a judgment about the
                  occupation. Preparation is an approximate underemployment
                  flag.
                </p>
              </div>
              <div className="detail-section">
                <div className="section-label">
                  Market opportunity
                  <span>
                    {detail.trend?.start ?? '—'}–{detail.trend?.end ?? '—'}
                  </span>
                </div>
                <div className="outlook-grid">
                  <div>
                    <strong>
                      {detail.trend?.growth == null
                        ? '—'
                        : `${detail.trend.growth > 0 ? '+' : ''}${detail.trend.growth}%`}
                    </strong>
                    <span>Projected growth</span>
                  </div>
                  <div>
                    <strong>
                      {detail.trend?.openings == null
                        ? '—'
                        : detail.trend.openings.toLocaleString()}
                    </strong>
                    <span>Annual openings</span>
                  </div>
                </div>
                <p className="microcopy">
                  National openings from growth and replacement; not live job
                  listings or your probability of employment.
                  {detail.trend?.group
                    ? ` Outlook group: ${detail.trend.group}.`
                    : ''}
                </p>
                <a
                  className="source-link"
                  href={
                    detail.trend?.source ??
                    `https://www.onetonline.org/link/localtrends/${detail.id}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  BLS projections via O*NET
                  <ExternalLink size={12} />
                </a>
              </div>
              <div className="detail-section wage-section">
                <div className="section-label">
                  {unit === 'annual' ? 'Annual' : 'Hourly'} wages
                  <span>US · {detail.wage?.year ?? 'Not reported'}</span>
                </div>
                <div className="big-wage">
                  {money(wageAt(detail, percentile, unit), false, unit)}
                  <span>
                    {wageAt(detail, percentile, unit)
                      ? unit === 'annual'
                        ? '/ year'
                        : '/ hour'
                      : ''}
                  </span>
                </div>
                <div className="detail-percentile">
                  {PERCENTILES[percentile]}th percentile{' '}
                  {percentile === 2 ? '· Median' : ''}
                </div>
                <div className="wage-bars">
                  {PERCENTILES.map((p, i) => {
                    const w = wageAt(detail, i, unit);
                    const max = Math.max(
                      ...(detail.wage?.[unit] ?? []).map((v) => v?.value ?? 0),
                      1,
                    );
                    return (
                      <button
                        key={p}
                        className={i === percentile ? 'active' : ''}
                        onClick={() => setPercentile(i)}
                        aria-label={`Show ${p}th percentile wage`}
                      >
                        <span>{money(w, true, unit)}</span>
                        <i
                          style={{
                            height: `${w ? 20 + (65 * w.value) / max : 4}px`,
                          }}
                        />
                        <small>P{p}</small>
                      </button>
                    );
                  })}
                </div>
                <Slider
                  aria-label="Occupation wage percentile"
                  min={0}
                  max={4}
                  step={1}
                  value={[percentile]}
                  onValueChange={(v) =>
                    setPercentile(Array.isArray(v) ? v[0] : v)
                  }
                />
                <p className="microcopy">
                  {detail.wage?.group
                    ? `Wage group: ${detail.wage.group}. Specialized titles share this broader estimate.`
                    : 'National occupation wage estimates.'}{' '}
                  {wageAt(detail, percentile, unit)?.capped
                    ? 'The + indicates a published lower bound; higher wages are not separately reported.'
                    : ''}
                </p>
                <a
                  className="source-link"
                  href={
                    detail.wage?.source ??
                    `https://www.onetonline.org/link/localwages/${detail.id}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  BLS wages via O*NET OnLine
                  <ExternalLink size={12} />
                </a>
              </div>
              {hasProfile && (
                <div className="detail-section">
                  <div className="section-label">
                    Your skill alignment
                    <strong>{scores.get(detail.id)?.score ?? '—'} / 100</strong>
                  </div>
                  <p className="microcopy">
                    Based on {scores.get(detail.id)?.coverage}% of this role’s
                    total skill importance. Remaining skills are unknown. This
                    is not a qualification or hiring score.
                  </p>
                  {detail.skills
                    .map((v, i) => ({
                      i,
                      v,
                      gap:
                        v === null
                          ? 0
                          : Math.max(0, v - (effectiveProfile[i] ?? 0)),
                    }))
                    .filter(
                      (s) =>
                        s.v !== null && effectiveProfile[s.i] !== undefined,
                    )
                    .sort((a, b) => b.gap - a.gap)
                    .slice(0, 5)
                    .map((s) => (
                      <div className="gap-row" key={s.i}>
                        <span>{data?.skills[s.i].name}</span>
                        <strong>
                          {effectiveProfile[s.i].toFixed(1)}
                          <span> / {s.v?.toFixed(1)}</span>
                        </strong>
                        {s.gap > 0 ? (
                          <ArrowUpRight size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                      </div>
                    ))}
                  <p className="microcopy">
                    Your estimated level / O*NET occupational level.
                  </p>
                </div>
              )}
              <div className="detail-section">
                <div className="section-label">
                  What the work involves<span>{detail.tasks.length} tasks</span>
                </div>
                <ul className="task-list">
                  {detail.tasks.slice(0, 6).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <details className="more-tasks">
                  <summary>
                    All tasks & work activities
                    <ChevronDown size={14} />
                  </summary>
                  <ul className="task-list">
                    {detail.tasks.slice(6).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <div className="activity-tags">
                    {detail.activities.map((i) => (
                      <span key={i}>{data?.activities[i]}</span>
                    ))}
                  </div>
                </details>
              </div>
              <div className="detail-section">
                <div className="section-label">
                  {basis === 'skills'
                    ? 'Similar skill profiles'
                    : 'Similar work activities'}
                </div>
                {basis === 'skills' && (
                  <p className="microcopy">
                    {70 - (detail.imputedMeasurements ?? 0)} of 70 skill
                    measurements reported. Missing measurements use dataset
                    medians for this layout only; your fit score keeps them
                    unknown.
                  </p>
                )}
                {detail.neighbors.slice(0, 5).map(([id, similarity]) => {
                  const o = byId.get(id);
                  return o ? (
                    <button
                      className="result-row"
                      key={id}
                      onClick={() => roleSelect(id)}
                    >
                      <i style={{ background: COLORS[o.cluster] }} />
                      <span>
                        {o.title}
                        <small>
                          {Math.round(similarity * 100)}/100{' '}
                          {basis === 'skills' ? 'skill-profile' : 'activity'}{' '}
                          similarity
                        </small>
                      </span>
                      <strong>
                        {money(wageAt(o, percentile, unit), true, unit)}
                      </strong>
                    </button>
                  ) : null;
                })}
              </div>
              <a
                className="occupation-link"
                href={`https://www.onetonline.org/link/summary/${detail.id}`}
                target="_blank"
                rel="noreferrer"
              >
                View full O*NET occupation
                <ArrowUpRight size={16} />
              </a>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={about} onOpenChange={setAbout}>
        <SheetContent className="detail-sheet method-sheet">
          <SheetTitle className="detail-title">
            Behind the constellation.
          </SheetTitle>
          <SheetDescription>
            Where the data comes from, and how to read it.
          </SheetDescription>
          <h3>Cluster by skills or work activities.</h3>
          <p>
            Database exploration offers two independent layouts. Skills uses 35
            O*NET skill levels and their 35 importance ratings, standardized so
            each measurement has equal scale. Twelve K-means clusters and a
            Euclidean UMAP projection are computed from those profiles. Titles,
            SOC groups, and industries are not inputs. Labels identify
            distinguishing skills, and a selected group shows its reported mean
            levels.
          </p>
          <p>
            {data?.layouts.skills.imputedValues} missing skill measurements are
            filled with column medians for clustering and positioning only. They
            remain missing for career fit. Connected roles use cosine similarity
            of standardized skill profiles, an index rather than a percentage of
            shared skills.
          </p>
          <p>
            The map uses {data?.activities.length.toLocaleString()} standardized
            Detailed Work Activities from the O*NET 31.0 Database. Common
            activities receive less weight. Twelve groups are calculated with
            K-means; UMAP places occupations in two dimensions. Labels summarize
            representative work; they are not official occupational categories.
          </p>
          <p>
            Nearby dots suggest related responsibilities. The two-dimensional
            layout distorts some distances. The connection scores in occupation
            details use the original feature profiles for the selected layout.
          </p>
          <p>
            {data?.excluded} occupations without task-to-activity mappings are
            excluded from the map.
          </p>
          <h3>Skills illuminate possibilities.</h3>
          <p>
            Your estimated skill level is compared with each occupation’s level,
            weighted by importance. The alignment score covers only rated
            skills; its coverage indicator shows how much is still unknown.
            Role-based suggestions are starting estimates for you to review.
            Education, licensing, and experience need independent checking.
          </p>
          <p>
            The focused map resizes and packs surviving activity groups, then
            spreads their remaining roles to use the available space. Group
            membership and source similarity scores stay unchanged; these
            compacted distances are for readability. Explore the database keeps
            the original layouts and does not apply your career guardrails.
          </p>
          <h3>What makes a strong path?</h3>
          <p>
            A role must meet every selected threshold: skill alignment, annual
            pay at the chosen percentile, projected growth, and annual openings.
            A role is flagged for potential underemployment when its Job Zone is
            at least two below your preparation proxy (bachelor’s: 4; graduate
            degree: 5). This does not measure the value of a job or establish
            credential requirements.
          </p>
          <p>
            Once you add profile details or change a guardrail, career
            navigation hides known threshold failures and removes empty groups
            from both the map and tree. Show all paths restores them for
            comparison in pink. Missing evidence stays visible in gray. Amber
            means alignment or growth is close to your minimum. Green means the
            available evidence meets your guardrails. At least four rated skills
            covering 20% of occupational skill importance are needed; this
            prototype threshold is a heuristic, not a validated prediction.
          </p>
          <p>
            Market demand uses the BLS projection period displayed for each
            role. National growth and openings do not capture local competition,
            visa status, recruiting practices, or an individual’s hiring
            likelihood. Raising a salary percentile changes a wage scenario, not
            your probability of achieving it.
          </p>
          <h3>Two layers: possibility and AI exposure.</h3>
          <p>
            The map groups tasks; the possibility tree samples up to three
            leading roles in each of four leading clusters under your filters.
            Tree branches show those groups, not a sequence of guaranteed
            transitions. Node centers and base branches show outcome quality.
            Red rings and red branch segments show the chosen AI index, from
            0–100. Gray dashed rings mean missing data.
          </p>
          <p>
            Red highlights start at your adjustable cutoff, initially 30/100.
            That is a visual comparison setting, not a validated danger
            threshold. AI exposure is not subtracted from your career score,
            pay, or hiring likelihood.
          </p>
          <p>
            Research checked September 8, 2026. The latest Anthropic Economic
            Index release listed in its official repository was June 26, 2026,
            covering April and May usage. We show its May global Claude
            chat/Cowork automation and augmentation shares in role details. They
            describe AI interactions, not total occupational work.
          </p>
          <a
            href="https://huggingface.co/datasets/Anthropic/EconomicIndex/blob/main/release_2026_06_26/data_documentation.md"
            target="_blank"
            rel="noreferrer"
          >
            June release definitions
            <ExternalLink size={13} />
          </a>
          <p>
            The occupation overlay uses Massenkoff & McCrory’s March 5, 2026
            observed-exposure dataset (
            {
              data?.occupations.filter((o) => aiValue(o, 'observed') !== null)
                .length
            }{' '}
            mapped roles). The paper combines theoretical task feasibility and
            measured professional Claude use, weighting automation more than
            augmentation. Its study found no systematic rise in unemployment for
            more exposed workers, with suggestive evidence of slower hiring of
            younger workers.
          </p>
          <a href={AI_SOURCES.observed.source} target="_blank" rel="noreferrer">
            Anthropic · Labor market impacts of AI
            <ExternalLink size={13} />
          </a>
          <p>
            The alternative is Tomlinson, Jaffe, Wang, Counts & Suri’s Working
            with AI, v6, December 22, 2025 (
            {
              data?.occupations.filter(
                (o) => aiValue(o, 'applicability') !== null,
              ).length
            }{' '}
            mapped roles). It combines coverage, completion, and scope across
            Bing Copilot activity. Applicability includes productive assistance
            and is not a displacement estimate. These two indices have different
            definitions and should not be averaged or treated as a time series.
          </p>
          <a
            href={AI_SOURCES.applicability.source}
            target="_blank"
            rel="noreferrer"
          >
            Microsoft · Working with AI
            <ExternalLink size={13} />
          </a>
          <p>
            Both indices are joined by exact detailed SOC group codes;
            specializations inherit the broader group. The May usage snapshot
            joins exact O*NET codes (
            {data?.occupations.filter((o) => o.ai?.usage).length} mapped roles).
            Missing matches stay unknown. These product-specific samples do not
            represent all employers, AI products, robots, or local labor
            markets; zero measured exposure does not establish long-term safety.
          </p>
          <h3>Search and your broader profile.</h3>
          <p>
            Fuzzy search ranks official titles and O*NET alternate titles using
            subsequence, transposition, and trigram similarity, with exact
            task-text fallback. It never fuzzy-matches research data to
            occupations. Education distinguishes master’s, doctorate, and
            professional degrees, sharing a graduate preparation proxy for the
            underemployment flag.
          </p>
          <p>
            Major, hobbies, talents, athletic experience, and training
            contribute keyword affinity as a final ranking tie-breaker and
            suggest skills for you to confirm. School/provider and physical
            notes are context only. Optional ability self-ratings are compared
            with O*NET level ratings; gaps trigger a review of demands,
            supports, and accommodations. They are not medical assessments or
            eligibility exclusions.
          </p>
          <h3>Pay percentiles, clearly defined.</h3>
          <p>
            BLS Occupational Employment and Wage Statistics, May 2025, national
            estimates, retrieved through O*NET OnLine. P50 is the median: half
            of workers earn less and half earn more. The slider uses the five
            published percentiles, without interpolation.
          </p>
          <p>
            These are wages, not total compensation. They do not include
            benefits or equity and are not an individual earnings forecast. A
            “+” is a published lower bound; “Not reported” means unavailable or
            suppressed. Some roles publish only hourly wages. Specialized
            occupations can share a broader wage group, identified in their
            details.
          </p>
          <a
            href="https://www.bls.gov/oes/tables.htm"
            target="_blank"
            rel="noreferrer"
          >
            BLS wage tables
            <ExternalLink size={13} />
          </a>
          <a
            href="https://www.onetonline.org/help/online/scales"
            target="_blank"
            rel="noreferrer"
          >
            O*NET rating scales
            <ExternalLink size={13} />
          </a>
          <h3>Attribution</h3>
          <p>
            Anthropic Economic Index data and Microsoft Working with AI results
            are used under CC BY 4.0. Atlas transforms scores into map overlays
            and joins them to O*NET occupations. The research authors have not
            endorsed these visualizations or career assessments.
          </p>
          <a href={AI_SOURCES.observed.data} target="_blank" rel="noreferrer">
            Anthropic source data
            <ExternalLink size={13} />
          </a>
          <a
            href={AI_SOURCES.applicability.data}
            target="_blank"
            rel="noreferrer"
          >
            Microsoft source data & attribution
            <ExternalLink size={13} />
          </a>

          <p>
            Includes information from the{' '}
            <a
              href="https://www.onetcenter.org/database.html"
              target="_blank"
              rel="noreferrer"
            >
              O*NET 31.0 Database
            </a>{' '}
            by the U.S. Department of Labor, Employment and Training
            Administration, used under{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
            . O*NET® is a trademark of USDOL/ETA. Atlas adds clustering, map
            positions, labels, and exploratory matching. USDOL/ETA has not
            approved, endorsed, or tested these modifications.
          </p>
        </SheetContent>
      </Sheet>
    </main>
  );
}
