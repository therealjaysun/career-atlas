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

`public/onet.json` contains 923 occupations, their task statements, 2,085 Detailed Work Activities, 35 skill dimensions, 52 abilities, 50,583 alternate titles, national wage percentiles, employment projections, and AI research measures. The browser makes one local static-data request; exploration does not call external services.

Original occupational data: [O*NET 31.0 Database](https://www.onetcenter.org/database.html), USDOL/ETA, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Atlas adds clusters, coordinates, labels, and heuristic matching; USDOL/ETA has not approved, endorsed, or tested these modifications. O*NET® is a trademark of USDOL/ETA. The app includes attribution and individual source links.

Download these official CSVs from `https://www.onetcenter.org/dl_files/database/db_31_0_csv/` into a local directory: `occupation_data.csv`, `tasks_to_dwas.csv`, `essential_skills.csv`, `transferable_skills.csv`, `job_zones.csv`.

With Python, numpy, scikit-learn, and umap-learn installed:

```sh
python scripts/prepare_data.py /path/to/csv-directory
python scripts/prepare_wages.py
python scripts/prepare_trends.py
python scripts/prepare_enrichment.py /tmp/onet-enrichment
node tests/check.mjs
```

Run those commands sequentially: each later script attaches data to the first output. Wage and outlook pages are cached under `/tmp/onet-wages` and `/tmp/onet-trends`. Delete those specific caches before intentionally refreshing them. They retrieve public official pages with four concurrent requests and a per-request delay. Enrichment downloads missing O*NET title/ability files and pinned research inputs into its specified cache. The June usage input is about 219 MB; only the May global occupation subset is retained. No keys or credentials are required.

Built with numpy 2.5.3, scipy 1.18.1, scikit-learn 1.9.0, umap-learn 0.5.12. DWA presence is binary per occupation, IDF weighted and L2 normalized. K-means uses 12 clusters, 20 initializations, random seed 42. UMAP uses cosine distance, 22 neighbors, min_dist 0.22, seed 42. Neighbor scores use original vector cosine similarity. There are 93 unmodeled occupations lacking DWA mappings. Labels summarize groups, not official categories; UMAP distances and cluster boundaries are approximate.

Wages: BLS OEWS May 2025, retrieved via each occupation's official O*NET OnLine national wages page. All 923 pages loaded; annual estimates available for 919 occupations. The others remain missing (hourly mode may have estimates). P10/P25/P50/P75/P90 are the five published percentiles, never interpolated. Censoring and missing values are preserved; broader wage groups are identified. These wages exclude benefits/equity and are not a total compensation forecast.

Market demand: BLS national employment projections as published on each O*NET OnLine trend page. All 923 roles currently show 2024–2034 projections. Openings include growth and replacement, not just net new jobs. Broader outlook groups are identified. This is a market opportunity proxy, not a personal hiring probability.

## Outcome rules

Skill alignment is importance-weighted coverage of required levels, over rated skills only; unknown skills do not become zero. Coverage is the share of total skill importance that has been rated. At least 4 rated dimensions and 20% coverage are needed before returning a strong outcome; these are explicit prototype heuristics.

Default editable guardrails: 80/100 alignment, $60,000 annual pay at the selected percentile, at least 0% projected employment growth, at least 1,000 annual national openings. Education starts unknown. Bachelor’s education maps to preparation proxy 4, graduate education to 5; a Job Zone at least two below that proxy flags **potential** underemployment. Job Zones are not degree requirements, and this does not assess the value of an occupation. Licensing, experience, local demand, and degree field need separate consideration.

Any known failure produces “Below your thresholds.” Missing evidence produces “Needs more evidence” when no known failure exists. Fit within 8 points or growth within 2 percentage points above the minimum produces “Trade-offs.” Otherwise the outcome is “Strong path.” No weighted average lets high skill fit cancel a salary or preparation failure. Pay thresholds always use annual wages, even when the display is hourly. Top-coded wages below the pay target remain unknown rather than being assumed too low.

## Validation

`tests/check.mjs` checks every data record and the shared matching/pay/outcome logic, including typo ranking, alternate titles, interest affinity, ability-demand cautions, unknown skills, percentile changes, missing outlook, censored wages, a PhD-to-cashier underemployment case, exact AI joins, and missing versus zero AI scores. TypeScript compilation and the production build are required.

One optional WebMCP tool (`explore_occupation`) is registered only in supporting browsers. No supported WebMCP validation context was available during this build, so its runtime contract is unverified. Browser UI testing was not performed; the provided Sites workflow reserves it for an explicit request.

## Broader profiles and fuzzy search

Previous jobs support multiple title selections. The **My skills** window compiles every reported positive skill level from those jobs alongside the user's own additions. Each skill appears once, showing all contributing jobs; its suggested level is the highest reported level, never a sum. Suggestions stay outside career scoring until checked, rated, or explicitly accepted together. Existing ratings, including zero, always win and remain when a job is removed. Unrated suggestions from removed jobs disappear when no remaining job supplies them.

The window also supports selecting and adding several skills together. New manual additions start at 3/7 for review, preserving any existing ratings. Editing skill ratings updates the map; learning scenarios remain separate. These entries remain local to the current tab.

Title search ranks canonical and alternate O*NET titles with installed cmdk's subsequence/transposition matching, plus a short trigram fallback for substitutions. Exact task text remains searchable. Database results preserve relevance order; occupation pickers show the nearest 50 matches. Deferred inputs keep typing responsive. This is local search, not an embedding service.

Education has distinct master’s, doctorate, and professional entries, all mapping to graduate preparation proxy 5. Major, training, hobbies, talents, and athletic experience provide **keyword affinity** as a final tie-breaker and suggest skills to confirm. Entering a credential never automatically grants a skill or a license. School/provider and physical notes remain personal context, without prestige or medical scoring. Optional ability ratings use the O*NET 0–7 level scale; role demands more than 0.5 above a self-rating add a trade-off caution. Unknown ability data remains unknown, and accommodations/actual job conditions require review.

The possibility tree shows up to three ranked roles in each of the first four ranked clusters. It groups candidate outcomes, not sequential career transitions. Skill scenarios update it alongside the map.

## AI evidence and visualization

Research checked **September 8, 2026**. Sources and dates are visible in the application:

| Measure | Source | Mapped roles | Interpretation |
| --- | --- | --- | --- |
| Observed exposure | Massenkoff & McCrory, [Anthropic, March 5, 2026](https://www.anthropic.com/research/labor-market-impacts) | 876 | Time-weighted task index combining theoretical LLM capability with measured professional Claude use, with more weight on automation. |
| AI applicability | Tomlinson, Jaffe, Wang, Counts & Suri, [Working with AI v6, December 22, 2025](https://arxiv.org/abs/2507.07935v6) | 893 | Bing Copilot activity coverage, successful completion, and scope. Includes assistance, not just automation. |
| May usage patterns | [Anthropic June 26, 2026 Economic Index](https://www.anthropic.com/research/economic-index-june-2026-report) | 718 | Global Claude chat/Cowork automation and augmentation shares within measured interactions associated with each role's tasks. |

June 26 was the latest Economic Index release listed in the [official repository](https://huggingface.co/datasets/Anthropic/EconomicIndex/blob/main/README.md) when checked. Its April/May usage data is **not** an update to the March exposure index. Role details show May usage separately, preserving unpublished metrics. The March paper found no systematic increase in unemployment with exposure, with suggestive evidence of slower younger-worker hiring. Neither index estimates an individual's job-loss probability.

Node cores retain career fit/quality (or cluster/pay on the full map). Crimson arcs encode the selected AI index on a fixed 0–100 scale; tree branches also show a red segment proportional to the same index. Rings are emphasized from a user-adjustable threshold, initially 30/100. That cutoff is a visual preference, not a research-defined danger threshold. AI data does not reduce career scores, wages, or employment estimates. Gray dashed rings mean missing data; zero remains distinct. The two indices are not averaged or treated as comparable percentages or a time series.

Both occupation indices join **exact detailed SOC groups**, using the part before the O*NET specialization suffix. Specializations inherit the broader group's score; the source title/code is shown in details. May usage joins exact full O*NET codes. Fuzzy search is never used for data joins. These product-specific samples do not cover every AI product, employer, robot, or geographic market; low exposure is not proof of future safety.

Research snapshots are pinned in `scripts/prepare_enrichment.py`: Anthropic repository commit `2ea58ff75e4247d26810c37f10c179edc2466cac`; Microsoft commit `c94a07c52fb1d88ca5d221388f06d10e1bd6d2fe`. [Anthropic data](https://huggingface.co/datasets/Anthropic/EconomicIndex/tree/main/labor_market_impacts) and [Microsoft results](https://github.com/microsoft/working-with-ai) are used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Atlas adds joins, visualization, and career heuristics; the researchers have not endorsed these adaptations.
