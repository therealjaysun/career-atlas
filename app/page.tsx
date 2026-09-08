'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
} from 'lucide-react';
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
  pathQuality,
  QUALITY,
  DEFAULT_CRITERIA,
  type Criteria,
  CLUSTER_NAMES,
  COLORS,
  matches,
  money,
  payColor,
  PERCENTILES,
  wageAt,
  type Dataset,
  type Occupation,
  type Profile,
} from '@/lib/career';

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
function Picker({
  items,
  value,
  onChange,
  label,
  placeholder,
}: {
  items: { id: string; name: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <Combobox
      items={items}
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
export default function Home() {
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState('');
  const [mode, setMode] = useState('career'),
    [collapsed, setCollapsed] = useState(false),
    [phase, setPhase] = useState(1);
  const [role, setRole] = useState<string | null>(null),
    [profile, setProfile] = useState<Profile>({}),
    [addSkill, setAddSkill] = useState<string | null>(null);
  const [planned, setPlanned] = useState<string | null>(null),
    [plannedLevel, setPlannedLevel] = useState(4),
    [zone, setZone] = useState(0);
  const [criteria, setCriteria] = useState<Criteria>(DEFAULT_CRITERIA);
  const [query, setQuery] = useState(''),
    [cluster, setCluster] = useState<number | null>(null),
    [color, setColor] = useState('cluster');
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
        if (!Array.isArray(d.occupations) || !Array.isArray(d.skills))
          throw Error('The dataset format is invalid.');
        setData(d);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => c.abort();
  }, []);
  const occupations = data?.occupations ?? [];
  const byId = useMemo(
    () => new Map(occupations.map((o) => [o.id, o])),
    [data],
  );
  const currentRole = role ? byId.get(role) : null;
  const skillItems = useMemo(
    () => data?.skills.map((s, i) => ({ id: String(i), name: s.name })) ?? [],
    [data],
  );
  const roleItems = useMemo(
    () => occupations.map((o) => ({ id: o.id, name: o.title })),
    [data],
  );
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
    [data, effectiveProfile],
  );
  const hasProfile = Object.keys(profile).length > 0 || planned !== null;
  const visible = useMemo(
    () => occupations.filter((o) => matches(o, query, cluster, zone)),
    [data, query, cluster, zone],
  );
  const visibleIds = useMemo(
    () => new Set(visible.map((o) => o.id)),
    [visible],
  );
  const quality = useMemo(
    () =>
      new Map(
        occupations.map((o) => [
          o.id,
          pathQuality(o, effectiveProfile, criteria, percentile),
        ]),
      ),
    [data, effectiveProfile, criteria, percentile],
  );
  const ranked = useMemo(
    () =>
      [...visible].sort((a, b) =>
        mode === 'career' && hasProfile
          ? QUALITY[quality.get(b.id)!.status].order -
              QUALITY[quality.get(a.id)!.status].order ||
            (scores.get(b.id)?.score ?? -1) - (scores.get(a.id)?.score ?? -1)
          : a.title.localeCompare(b.title),
      ),
    [visible, mode, hasProfile, scores, quality],
  );
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
    hover = hovered ? byId.get(hovered) : null;
  const suggestions = currentRole
    ? currentRole.importance
        .map((v, i) => ({ i, v: v ?? 0 }))
        .filter((x) => currentRole.skills[x.i] !== null)
        .sort((a, b) => b.v - a.v)
        .slice(0, 6)
    : [];
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
        <a className="brand" href="/" aria-label="Atlas home">
          <Orbit size={28} />
          <span>
            atlas<span className="brand-dot">.</span>
          </span>
          <span className="brand-caption">A WORLD OF POSSIBILITIES</span>
        </a>
        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(String(v));
            setQuery('');
            setCluster(null);
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
            <Bubble
              step="01 · YOUR EXPERIENCE"
              title="Start with what you know."
              subtitle="A role you’ve held is a useful starting point."
              open={phase === 1}
              onOpenChange={(v) => setPhase(v ? 1 : 0)}
            >
              <Picker
                items={roleItems}
                value={role}
                onChange={setRole}
                label="Previous occupation"
                placeholder="Find a role you’ve worked in…"
              />
              {currentRole ? (
                <>
                  <div className="suggested-tags">
                    {suggestions.slice(0, 3).map((s) => (
                      <span key={s.i}>{data?.skills[s.i].name}</span>
                    ))}
                  </div>
                  <p className="microcopy">
                    Suggested skills from this occupation. Review the levels to
                    reflect your own experience.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setProfile((p) => ({
                        ...Object.fromEntries(
                          suggestions.map((s) => [
                            s.i,
                            currentRole.skills[s.i] ?? 0,
                          ]),
                        ),
                        ...p,
                      }));
                      setPhase(2);
                    }}
                  >
                    Review my skills
                    <ArrowUpRight size={17} />
                  </button>
                </>
              ) : (
                <>
                  <div className="example-roles">
                    Try{' '}
                    <button onClick={() => setRole('15-1252.00')}>
                      Software developer
                    </button>
                    <span>or</span>
                    <button onClick={() => setRole('29-1141.00')}>
                      Registered nurse
                    </button>
                  </div>
                  <button className="text-button" onClick={() => setPhase(2)}>
                    Or start with your skills
                    <ChevronRight size={15} />
                  </button>
                </>
              )}
            </Bubble>
            <Bubble
              step={`02 · YOUR SKILLS${Object.keys(profile).length ? ` · ${Object.keys(profile).length} ADDED` : ''}`}
              title="What can you do?"
              subtitle="Estimate your level from 0–7. Unrated skills stay unknown."
              open={phase === 2}
              onOpenChange={(v) => setPhase(v ? 2 : 0)}
            >
              <Picker
                items={skillItems.filter((s) => profile[s.id] === undefined)}
                value={addSkill}
                onChange={(v) => {
                  if (v !== null) {
                    setProfile((p) => ({ ...p, [v]: 3 }));
                    setAddSkill(null);
                  }
                }}
                label="Add a skill"
                placeholder="Add a skill…"
              />
              <div className="skill-list">
                {Object.entries(profile).map(([id, level]) => (
                  <div className="skill-row" key={id}>
                    <div>
                      <label id={`skill-${id}`}>
                        {data?.skills[Number(id)]?.name}
                      </label>
                      <span>{level.toFixed(1)}</span>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${data?.skills[Number(id)]?.name}`}
                        onClick={() =>
                          setProfile((p) => {
                            const next = { ...p };
                            delete next[id];
                            return next;
                          })
                        }
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <Slider
                      aria-labelledby={`skill-${id}`}
                      min={0}
                      max={7}
                      step={0.5}
                      value={[level]}
                      onValueChange={(v) =>
                        setProfile((p) => ({
                          ...p,
                          [id]: Array.isArray(v) ? v[0] : v,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              {Object.keys(profile).length > 0 ? (
                <>
                  <p className="microcopy">
                    Exploratory self-ratings. Alignment covers only the skills
                    you’ve rated.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => setPhase(3)}
                  >
                    Explore my next chapter
                    <ArrowUpRight size={17} />
                  </button>
                </>
              ) : (
                <p className="empty-hint">
                  Add your first skill to light up the map.
                </p>
              )}
            </Bubble>
            <Bubble
              step="03 · YOUR NEXT CHAPTER"
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
              <label className="field-label">Preparation you’re open to</label>
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
              step="04 · YOUR GUARDRAILS"
              title="What makes a good next move?"
              subtitle="Set your own thresholds. Flag potential underemployment and weaker outcomes."
              open={phase === 4}
              onOpenChange={(v) => setPhase(v ? 4 : 0)}
            >
              <label className="field-label">Your highest education</label>
              <Select
                value={String(criteria.education)}
                onValueChange={(v) =>
                  setCriteria((c) => ({ ...c, education: Number(v) }))
                }
              >
                <SelectTrigger
                  className="full-select"
                  aria-label="Highest education"
                >
                  <SelectValue>
                    {
                      [
                        'Not provided',
                        'No degree / high school',
                        'Some college',
                        'Associate / vocational',
                        'Bachelor’s degree',
                        'Master’s / PhD / professional',
                      ][criteria.education]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[
                    'Not provided',
                    'No degree / high school',
                    'Some college',
                    'Associate / vocational',
                    'Bachelor’s degree',
                    'Master’s / PhD / professional',
                  ].map((label, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <label id="fit-label">Minimum skill alignment</label>
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
            {hasProfile && (
              <div className="bubble matches-bubble">
                <div className="section-label">
                  <Sparkles size={14} />
                  Possibilities to explore<span>{visible.length}</span>
                </div>
                <p className="microcopy">
                  Ranked by your guardrails, then skill alignment.
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
              <label className="input-shell">
                <Search size={17} />
                <input
                  aria-label="Search occupations or tasks"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search titles, codes, or tasks…"
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
                <span>Responsibility clusters</span>
                {cluster !== null && (
                  <button onClick={() => setCluster(null)}>Clear</button>
                )}
              </div>
              <div className="cluster-filters">
                {data?.clusters.map((c) => (
                  <button
                    key={c.id}
                    className={cluster === c.id ? 'active' : ''}
                    onClick={() => setCluster(cluster === c.id ? null : c.id)}
                    aria-pressed={cluster === c.id}
                  >
                    <i style={{ background: COLORS[c.id] }} />
                    {CLUSTER_NAMES[c.id]}
                    <span>{c.count}</span>
                  </button>
                ))}
              </div>
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
                  No occupations match. Try another task or clear your filters.
                </p>
              )}
            </div>
          </>
        )}
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
      <section className="map-stage" aria-label="Interactive occupation map">
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
                {occupations.flatMap((o) =>
                  o.neighbors
                    .slice(0, 2)
                    .filter(
                      ([id, sim]) =>
                        id > o.id &&
                        sim > 0.13 &&
                        visibleIds.has(id) &&
                        visibleIds.has(o.id),
                    )
                    .map(([id]) => {
                      const target = byId.get(id)!;
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
              {data.clusters.map((c) => {
                const p = point(c);
                return (
                  <g
                    key={c.id}
                    className="cluster-label"
                    transform={`translate(${p.x},${p.y - 35})`}
                    opacity={cluster === null || cluster === c.id ? 1 : 0.12}
                    aria-hidden="true"
                  >
                    <text
                      textAnchor="middle"
                      fill={COLORS[c.id]}
                      style={{ fontSize: `${12 / Math.sqrt(view.k)}px` }}
                    >
                      {CLUSTER_NAMES[c.id]}
                    </text>
                  </g>
                );
              })}
              {occupations.map((o, i) => {
                const p = point(o),
                  score = scores.get(o.id)?.score ?? 0;
                const bright =
                  mode === 'career' && hasProfile && color !== 'quality';
                const active = selected === o.id || hovered === o.id;
                const fill =
                  color === 'pay'
                    ? payColor(wageAt(o, percentile, unit), unit)
                    : color === 'quality'
                      ? QUALITY[quality.get(o.id)!.status].color
                      : COLORS[o.cluster];
                const opacity = !visibleIds.has(o.id)
                  ? 0.065
                  : bright
                    ? 0.16 + 0.84 * (score / 100) ** 3
                    : 0.8;
                return (
                  <g
                    key={o.id}
                    data-occupation={o.id}
                    role="button"
                    tabIndex={focusIndex === i ? 0 : -1}
                    aria-label={`${o.title}, ${money(wageAt(o, percentile, unit), false, unit)} at percentile ${PERCENTILES[percentile]}`}
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
                            occupations.length) %
                          occupations.length;
                        setFocusIndex(next);
                        (
                          svgRef.current?.querySelector(
                            `[data-occupation="${occupations[next].id}"]`,
                          ) as SVGGElement
                        )?.focus();
                      }
                    }}
                    style={{ opacity }}
                  >
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
                      fill={fill}
                    />
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
            No matching occupations
            <button
              onClick={() => {
                reset();
                setZone(0);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
      {hover && (
        <div className="hover-card bubble" role="status">
          <div className="step-label" style={{ color: COLORS[hover.cluster] }}>
            {CLUSTER_NAMES[hover.cluster]}
          </div>
          <strong>{hover.title}</strong>
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
          <button onClick={() => setColor(color === 'pay' ? 'cluster' : 'pay')}>
            {color === 'pay' ? <Check size={12} /> : <Layers size={12} />}Pay on
            map
          </button>
        </div>
      </div>
      <div className="map-legend">
        {color === 'quality' ? (
          Object.entries(QUALITY).map(([key, q]) => (
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
            Unknown or lower alignment
            <span className="legend-glow" />
            Higher alignment
          </>
        ) : (
          <>
            <span className="legend-dot" />
            One dot, one occupation
            <span className="legend-line" />
            Shared responsibilities
          </>
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
                  {CLUSTER_NAMES[detail.cluster]}
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
                <div className="section-label">Connected occupations</div>
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
                          {Math.round(similarity * 100)}% activity similarity
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
          <h3>923 occupations. Shared responsibilities.</h3>
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
            details use the original activity profiles.
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
            Known threshold failures appear in pink. Missing evidence appears in
            gray. Amber means alignment or growth is close to your minimum.
            Green means the available evidence meets your guardrails. At least
            four rated skills covering 20% of occupational skill importance are
            needed; this prototype threshold is a heuristic, not a validated
            prediction.
          </p>
          <p>
            Market demand uses the BLS projection period displayed for each
            role. National growth and openings do not capture local competition,
            visa status, recruiting practices, or an individual’s hiring
            likelihood. Raising a salary percentile changes a wage scenario, not
            your probability of achieving it.
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
