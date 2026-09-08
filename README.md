# Atlas

Interactive occupation map with career navigation and database exploration. Client-side profiles live only in the current tab; no accounts, user database, or AI API is required.

## Run

Node 24 or later recommended.

```sh
npm install
npm run dev
node tests/check.mjs
npx tsc --noEmit
npm run build
```

## Data and reproducibility

`public/onet.json` contains 923 occupations, their task statements, 2,085 Detailed Work Activities, 35 skill dimensions, national wage percentiles, and employment projections. The browser makes one local static-data request; exploration does not call external services.

Original occupational data: [O*NET 31.0 Database](https://www.onetcenter.org/database.html), USDOL/ETA, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Atlas adds clusters, coordinates, labels, and heuristic matching; USDOL/ETA has not approved, endorsed, or tested these modifications. O*NET® is a trademark of USDOL/ETA. The app includes attribution and individual source links.

Download these official CSVs from `https://www.onetcenter.org/dl_files/database/db_31_0_csv/` into a local directory: `occupation_data.csv`, `tasks_to_dwas.csv`, `essential_skills.csv`, `transferable_skills.csv`, `job_zones.csv`.

With Python, numpy, scikit-learn, and umap-learn installed:

```sh
python scripts/prepare_data.py /path/to/csv-directory
python scripts/prepare_wages.py
python scripts/prepare_trends.py
node tests/check.mjs
```

Run those commands sequentially: the latter two attach data to the first output. Wage and outlook pages are cached under `/tmp/onet-wages` and `/tmp/onet-trends`. Delete those specific caches before intentionally refreshing them. They retrieve public official pages with four concurrent requests and a per-request delay. No keys or credentials are required.

Built with numpy 2.5.3, scipy 1.18.1, scikit-learn 1.9.0, umap-learn 0.5.12. DWA presence is binary per occupation, IDF weighted and L2 normalized. K-means uses 12 clusters, 20 initializations, random seed 42. UMAP uses cosine distance, 22 neighbors, min_dist 0.22, seed 42. Neighbor scores use original vector cosine similarity. There are 93 unmodeled occupations lacking DWA mappings. Labels summarize groups, not official categories; UMAP distances and cluster boundaries are approximate.

Wages: BLS OEWS May 2025, retrieved via each occupation's official O*NET OnLine national wages page. All 923 pages loaded; annual estimates available for 919 occupations. The others remain missing (hourly mode may have estimates). P10/P25/P50/P75/P90 are the five published percentiles, never interpolated. Censoring and missing values are preserved; broader wage groups are identified. These wages exclude benefits/equity and are not a total compensation forecast.

Market demand: BLS national employment projections as published on each O*NET OnLine trend page. All 923 roles currently show 2024–2034 projections. Openings include growth and replacement, not just net new jobs. Broader outlook groups are identified. This is a market opportunity proxy, not a personal hiring probability.

## Outcome rules

Skill alignment is importance-weighted coverage of required levels, over rated skills only; unknown skills do not become zero. Coverage is the share of total skill importance that has been rated. At least 4 rated dimensions and 20% coverage are needed before returning a strong outcome; these are explicit prototype heuristics.

Default editable guardrails: 80/100 alignment, $60,000 annual pay at the selected percentile, at least 0% projected employment growth, at least 1,000 annual national openings. Education starts unknown. Bachelor’s education maps to preparation proxy 4, graduate education to 5; a Job Zone at least two below that proxy flags **potential** underemployment. Job Zones are not degree requirements, and this does not assess the value of an occupation. Licensing, experience, local demand, and degree field need separate consideration.

Any known failure produces “Below your thresholds.” Missing evidence produces “Needs more evidence” when no known failure exists. Fit within 8 points or growth within 2 percentage points above the minimum produces “Trade-offs.” Otherwise the outcome is “Strong path.” No weighted average lets high skill fit cancel a salary or preparation failure. Pay thresholds always use annual wages, even when the display is hourly. Top-coded wages below the pay target remain unknown rather than being assumed too low.

## Validation

`tests/check.mjs` checks every data record and the shared matching/pay/outcome logic, including unknown skills, percentile changes, missing outlook, censored wages, and a graduate-degree-to-cashier underemployment case. TypeScript compilation and the production build are required.

One optional WebMCP tool (`explore_occupation`) is registered only in supporting browsers. No supported WebMCP validation context was available during this build, so its runtime contract is unverified. Browser UI testing was not performed; the provided Sites workflow reserves it for an explicit request.
