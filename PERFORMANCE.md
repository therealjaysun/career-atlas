# Performance and Ponytail audit — September 9, 2026

Implemented the useful findings without adding dependencies or removing career features or dataset records.

## Measured changes

| Measure | Before | After |
| --- | ---: | ---: |
| Initial JSON datasets, uncompressed | 13.66 MB | 5.53 MB |
| Generated client CSS | 231,493 bytes | 107,470 bytes |
| Generated client CSS, gzip | 35,588 bytes | 18,103 bytes |
| All generated client JavaScript, gzip | 263,666 bytes | 264,046 bytes |
| Empty school picker | 1.047 ms | 0.001 ms |
| School search: `stanford` | 9.709 ms | 2.885 ms |
| Certification search: `certifed profesional` | 275.369 ms | 115.543 ms |
| Occupation search: `software enginer` | 295.232 ms | 37.998 ms |

The 8.13 MB school, major, hobby, and certification catalog now loads when its fields or methodology are opened. Initial dataset volume falls 60%; opening those features still downloads the complete catalog. CSS falls 54%, or 49% compressed. JavaScript size is effectively unchanged; unused UI libraries were already excluded from the shipped JavaScript.

Search figures are medians of 15 alternating before/after runs in the same Node 24.18.1 process, after warmup, using actual dataset records. They measure repeated function execution, not browser interaction latency or page-load time. Search improvements range from 2.4× to 7.8× for these nonempty queries. Gzip figures are locally compressed build files, not observed network transfers.

## Implemented audit findings, ranked by impact

1. **delete:** Removed 49 unreachable UI scaffold and hook files, including `components/ui/sidebar.tsx`, `chart.tsx`, `calendar.tsx`, and `hooks/use-mobile.ts`. Removed unused exports from the remaining combobox, select, dialog, sheet, tabs, and input-group wrappers. All remaining runtime source files are reachable from the app entry points. This also eliminates Tailwind styles generated solely for unused components.
2. **shrink:** In `lib/career.ts`, normalized immutable title, alias, and task text once per record using weak caches. Prepare each query once, skip impossible fuzzy matches, and avoid trigram allocations when the similarity threshold cannot be reached. Empty large pickers return the first 50 records immediately. Removed the unused `matches` wrapper.
3. **yagni:** In `app/page.tsx`, deferred the background catalog until a feature needs it. Existing validation, abort handling, error display, and custom entries remain.
4. **delete:** Removed seven unused direct dependencies: `@shadcn/react`, `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, and `recharts`. No retained lockfile package versions changed.
5. **yagni:** Removed inactive placeholder database and bucket configuration from `vite.config.ts`, the unused monospace font in `app/layout.tsx`, and the generated TypeScript cache from source control. Removed redundant input wrapper grouping and click handling; the combobox input and trigger buttons retain their own accessible behavior.

No new component framework, search service, worker protocol, or cache package was needed.

## Verification

- Production build, TypeScript check, source lint, and whitespace checks passed.
- Existing runnable assertions verify all 923 occupations, fuzzy ranking, background mappings, career fit and underemployment rules, compensation, AI joins, tree filtering, zoom-independent labels, and viewport resize behavior.
- 124 comparisons against the previous implementation preserved exact search ordering and scores. Added permanent checks for accents, transpositions, repeated characters, substitution fallback, cached repeats, and empty/custom picker entries.
- Run `npm test` for regressions and `npm run benchmark` after `npm run build` for current timings and emitted asset sizes. Benchmarks are observational, with no machine-dependent pass/fail time limit.
- No browser performance trace or visual interaction test was performed in this pass.

Net runtime source reduction: **6,566 lines** across `app`, `components`, `hooks`, `lib`, and `vite.config.ts`; **7 direct dependencies removed, 0 added**. Documentation, tests, lockfile changes, and generated cache removal are excluded from that source-line total.
