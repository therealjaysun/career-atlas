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

`public/onet.json` contains 923 occupations, their task statements, 2,085 Detailed Work Activities, 35 skill dimensions, 52 abilities, 50,583 alternate titles, national wage percentiles, employment projections, industry memberships, and AI research measures. The browser initially loads this static dataset; the background suggestion catalog loads on demand. Exploration does not call external services.

Original occupational data: [O*NET 31.0 Database](https://www.onetcenter.org/database.html), USDOL/ETA, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Atlas adds clusters, coordinates, labels, and heuristic matching; USDOL/ETA has not approved, endorsed, or tested these modifications. O*NET® is a trademark of USDOL/ETA. The app includes attribution and individual source links.

Download these official CSVs from `https://www.onetcenter.org/dl_files/database/db_31_0_csv/` into a local directory: `occupation_data.csv`, `tasks_to_dwas.csv`, `essential_skills.csv`, `transferable_skills.csv`, `job_zones.csv`.

With Python, numpy, scikit-learn, and umap-learn installed:

```sh
python scripts/prepare_data.py /path/to/csv-directory
python scripts/prepare_wages.py
python scripts/prepare_trends.py
python scripts/prepare_enrichment.py /tmp/onet-enrichment
python scripts/prepare_clusters.py
node tests/check.mjs
```

Run those commands sequentially: each later script attaches data to the first output. Wage and outlook pages are cached under `/tmp/onet-wages` and `/tmp/onet-trends`. Delete those specific caches before intentionally refreshing them. They retrieve public official pages with four concurrent requests and a per-request delay. Enrichment downloads missing O*NET title/ability files and pinned research inputs into its specified cache. The June usage input is about 219 MB; only the May global occupation subset is retained. No keys or credentials are required.

Built with numpy 2.5.3, scipy 1.18.1, scikit-learn 1.9.0, umap-learn 0.5.12. DWA presence is binary per occupation, IDF weighted and L2 normalized. K-means uses 12 clusters, 20 initializations, random seed 42. UMAP uses cosine distance, 22 neighbors, min_dist 0.22, seed 42. Neighbor scores use original vector cosine similarity. There are 93 unmodeled occupations lacking DWA mappings. Labels summarize groups, not official categories; UMAP distances and cluster boundaries are approximate.

Database exploration defaults to **Skills**, with an **Activities** switch. The skills layout uses 35 required levels plus 35 importance ratings, column-median imputation for missing data, feature standardization, K-means (12 clusters, 20 starts, seed 42), and UMAP (Euclidean, 22 neighbors, min_dist 0.22, seed 42). Neighbor connections use cosine similarity of those standardized profiles. Switching layouts replaces coordinates, memberships, labels, filters, and neighbor scores together, while preserving wages, AI measures, and user ratings. Career navigation retains activity-based membership, with a compacted layout when focused on career guardrails. Neither model uses industries, titles, or SOC categories as features.

`prepare_clusters.py` adds this layout to the enriched dataset without replacing its occupational records. Skills labels use dimensions with high relative group demand; an overall lower-demand group instead shows its highest reported mean levels and is labeled foundational. Selected groups show their feature evidence. Activity labels describe representative actions rather than industries. These are descriptive clusters, not official categories.

Database exploration combines title/task search, cluster selection, minimum/maximum pay, and multiple industry selections. Pay uses the Compensation panel's percentile and annual/hourly unit; each unit keeps its own entered limits. Empty limits are unrestricted. Bounds are inclusive; missing wages are excluded when a limit is active. A top-coded wage can satisfy a minimum only if its published lower bound meets that minimum, and cannot prove any finite maximum. An inverted range returns no matches and displays a correction. Career guardrails remain separate. Clearing filters restores all database roles, and the surviving roles drive cloud nodes, links, labels, counts, and results. Filtering preserves the original skills/activity coordinates unless the work-style split is enabled.

Industry memberships come from the 20 [O*NET OnLine industry CSV lists](https://www.onetonline.org/find/industry), retrieved September 9, 2026. This snapshot lists industries employing at least 10% of an occupation's workers; it describes major employers, not every possible employer. Exact O*NET codes link 920 of 923 roles to one or more industries. Grouped source rows without an O*NET code are not inferred from titles. The three unlisted roles remain visible without an industry filter. Selecting several industries matches any of them, then intersects that set with the other filters. National occupational wages do not become industry-specific wages. Run `python3 scripts/prepare_industries.py /tmp/onet-industries` after dataset preparation to reproduce from cached CSVs or retrieve missing files; all downloads validate before the dataset is replaced.

There are 1,067 missing skill measurements across 83 roles. Imputation only affects the skills map, never user fit. Thirteen roles have no reported skill measurements: their positions are imputed, their node centers are hollow, and they have no skill-neighbor links. Other roles' neighbor lists exclude these unmeasured profiles. Role details show source coverage. Cosine similarity is an index, not a percentage of shared skills.

Wages: BLS OEWS May 2025, retrieved via each occupation's official O*NET OnLine national wages page. All 923 pages loaded; annual estimates available for 919 occupations. The others remain missing (hourly mode may have estimates). P10/P25/P50/P75/P90 are the five published percentiles, never interpolated. Censoring and missing values are preserved; broader wage groups are identified. These wages exclude benefits/equity and are not a total compensation forecast.

Market demand: BLS national employment projections as published on each O*NET OnLine trend page. All 923 roles currently show 2024–2034 projections. Openings include growth and replacement, not just net new jobs. Broader outlook groups are identified. This is a market opportunity proxy, not a personal hiring probability.

The interface translates O*NET’s four preparation categories into familiar education and training descriptions, with the same labels in the filter and occupation details. Choices cover high school and job training, trade school or an associate degree, typically a bachelor’s degree, and typically a graduate degree. The filter includes roles at or below the selected category; “Any education or training” includes all. Descriptions preserve the distinction between typical education, experience, and actual employer requirements. Source: [O*NET category definitions](https://www.onetonline.org/help/online/zones). The dataset uses codes 2–5; the obsolete empty code-1 option is omitted.

## Physical and knowledge work

Explore's **Physical or knowledge work?** panel adds a two-sided cloud, an invertible slider, and **Work style** dot colors (blue → ochre, with AI exposure retaining its separate rust rings). All work styles are initially included. Selecting a direction keeps index values at or below the cutoff for knowledge work, or at or above it for physical/manual work. Invert keeps the number and swaps the direction. These filters intersect pay, industry, title, education, and cluster selections; clearing filters restores all work styles. Career guardrails remain independent.

`lib/work-style.ts` derives an exploratory index from the existing [O*NET ability requirements](https://www.onetonline.org/find/descriptor/browse/1.A): 9 physical (`1.A.3`), 10 psychomotor/manual (`1.A.2`), and 21 cognitive (`1.A.1`) dimensions. Each domain averages its reported 0–7 levels, requiring at least 80% coverage. Physical and manual means receive equal weight. Their combined value and the cognitive mean are separately converted to tied midrank percentiles across all 905 complete source occupations. The rounded index is `(physical/manual percentile + 100 − cognitive percentile) / 2`. The reference population is computed before any filtering, so filtering or switching cluster basis cannot change a role's index.

This is a relative demand comparison, not a validated white/blue-collar classifier, working-time percentage, or personal capability assessment. Low physical demand does not establish high cognitive demand; role details show all three original domain averages. The 18 occupations with incomplete data remain unclassified, are gray in work-style color mode, appear in a separate row in the split layout, and are excluded when a work-style direction filter is active or 3D requires their missing measurements.

The optional split places indices below 50 on the knowledge-led half and 50 or above on the physical/manual-led half. Within each half it rescales the original coordinates, preserves every skill/activity cluster ID and source neighbor score, and supplies separate labels for each surviving subcluster. This is a layout transformation, not a new clustering model; distances across halves have no similarity interpretation. Labels retain their screen font size while zooming. The existing assertion script checks ranking, ties, zero versus missing data, coverage, inverted boundaries, combined filters, complete role retention, subgroup membership, label bounds, and immutability in both layouts.

## Three-dimensional exploration

The main-map **2D / 3D** control projects the existing skill/activity coordinates into a rotatable perspective view. Depth defaults to the physical/knowledge work index; it can instead show the selected wage percentile/unit or selected AI index. It extends the existing layout, preserving subgroup membership and source neighbor scores, rather than running a new 3D clustering model. The side-by-side 2D work split is suspended while 3D is active and restored when returning to 2D. Career maps support the same depth controls; the possibility tree remains 2D.

Work style and AI depth use fixed 0–100 scales. Pay depth uses zero to the maximum uncensored source wage for the selected percentile/unit, computed before filtering. The 3D view hides roles with imputed layout measurements or missing active depth/field measurements, including top-coded wages when pay supplies depth or the field. The 2D view keeps its existing missing-data behavior. Hidden roles are removed before nodes, links, labels, group counts, and results are built; zero remains valid. Axis endpoints, hover text, and accessible occupation labels identify the displayed measure. All existing pay, industry, work-style, search, cluster, and career filters still determine membership.

Drag to rotate freely, Alt/Option-drag horizontally to roll, Shift-drag to pan, and scroll or use buttons to zoom. Rotation uses normalized quaternions with no tilt, yaw, or roll locks; consecutive drags rotate around screen axes without a fixed-up constraint. Six rotation/roll buttons support keyboard and touch. Reset restores the starting orientation and framing without clearing filters. Perspective sizing and depth-sorted SVG nodes communicate depth; labels remain screen-sized. Painting order changes independently of keyboard navigation and ranked results. Projection runs only when its inputs change, without an idle animation loop or an additional rendering dependency.

## Smooth intensity fields

The main-window **Intensity field** control offers Off, Overlay dots, and Field only for both 2D and 3D maps. Choose national pay at the selected percentile/unit or the selected AI index. A single **blue/red** palette maps higher pay and lower AI impact to blue, and lower pay and higher AI impact to red. There is no palette selector. Smoothing and opacity are adjustable. Field only hides dot cores, rings, and similarity lines while keeping occupation hit targets, keyboard navigation, hover details, group labels, and a focus outline.

`lib/intensity-field.ts` computes a Gaussian distance-weighted mean of measured, normalized values on a bounded grid (96² in 2D, 24³ in 3D). The kernel uses the selected smoothing radius and truncates at three standard deviations. The color is the local mean, not point density; fading indicates weak nearby support. Missing values and top-coded wages do not contribute zeros. Spatial averaging still uses measured values. Colors are then mapped through the interquartile scale described below; depth positions retain their original scales. The interpolation summarizes nearby occupations; it does not predict unobserved occupations, earnings, or job-loss probabilities.

Field colors use the **25th percentile → median → 75th percentile** of all measured occupations for the selected pay percentile/unit or AI index. Quartiles use linear interpolation between ordered observations at `(n − 1) × p`, with each occupation weighted equally; missing and top-coded values are excluded. These cross-occupation quartiles are separate from the wage percentile chosen for each role. Each half of the color scale uses cubic smoothstep, `t²(3 − 2t)`, from the median to its quartile; values outside the IQR saturate. Scaling happens **after** Gaussian averaging, preserving the meaning of local averages. The blue/red palette uses the same metric-aware direction in 2D and 3D, including the legend and quartile swatches. The legend shows actual quartile values and matching color swatches. Filters, rotation, and smoothing do not change the reference quartiles. If one half is tied, its width falls back to the full IQR; a zero IQR keeps the median neutral and places differing values at the corresponding endpoint. Empty data produces no field.

`components/intensity-field.tsx` displays a smoothly upscaled canvas texture behind the 2D map. In 3D, depth-sorted translucent radial samples render the interpolated volume in the same projection as occupations. Grid and color textures are memoized independently of the camera; rotation/panning redraw existing samples without recomputing interpolation. The field has no idle animation loop, caps display pixel ratio at 2, and uses no added dependency. 3D excludes incomplete layout, depth, or active field data before all map/result calculations; switching off the field restores roles that were excluded only for that measure.

## Outcome rules

Skill alignment is importance-weighted coverage of required levels, over rated skills only; unknown skills do not become zero. Coverage is the share of total skill importance that has been rated. At least 4 rated dimensions and 20% coverage are needed before returning a strong outcome; these are explicit prototype heuristics.

Default editable guardrails: 80/100 alignment, $60,000 annual pay at the selected percentile, at least 0% projected employment growth, at least 1,000 annual national openings. Education starts unknown. Bachelor’s education maps to preparation proxy 4, graduate education to 5; a Job Zone at least two below that proxy flags **potential** underemployment. Job Zones are not degree requirements, and this does not assess the value of an occupation. Licensing, experience, local demand, and degree field need separate consideration.

Any known failure produces “Below your thresholds.” Missing evidence produces “Needs more evidence” when no known failure exists. Fit within 8 points or growth within 2 percentage points above the minimum produces “Trade-offs.” Otherwise the outcome is “Strong path.” No weighted average lets high skill fit cancel a salary or preparation failure. Pay thresholds always use annual wages, even when the display is hourly. Top-coded wages below the pay target remain unknown rather than being assumed too low.

Career navigation’s map automatically hides known threshold failures once profile details are entered or a guardrail changes. Roles with insufficient evidence remain visible; skill-based exclusions still require four ratings and 20% coverage. Unconfirmed job suggestions, school/provider names, and physical notes do not become proficiency ratings. The default **Show all paths** switch is off; turning it on restores the original map and weaker outcomes. Database exploration does not apply career guardrails.

The map’s surviving role set drives its points, connection endpoints, group labels/counts, and ranked results. The tree uses the shared minimum fit score plus all guardrail outcomes, removing excluded roles before building branches, positions, counts, and ranked results. Empty groups disappear. A deterministic circle-packing layout sizes surviving activity groups by their role counts, packs them into the available space, and spreads remaining points inside each group. It preserves membership, records, and source similarity scores, not UMAP distances. Node positions animate with reduced-motion support. Empty results offer guardrail adjustment or restoration of all paths. This bounded pairwise layout is intended for the current 923-role dataset.

## Validation

`tests/check.mjs` checks every data record and the shared matching/pay/outcome logic, including typo ranking, alternate titles, interest affinity, ability-demand cautions, unknown skills, percentile changes, missing outlook, censored wages, a PhD-to-cashier underemployment case, exact AI joins, and missing versus zero AI scores. TypeScript compilation and the production build are required.

One optional WebMCP tool (`explore_occupation`) is registered only in supporting browsers. No supported WebMCP validation context was available during this build, so its runtime contract is unverified. Browser UI testing was not performed; the provided Sites workflow reserves it for an explicit request.

## Background dropdown sources

Schools, fields of study, hobbies, and certifications use the same accessible multi-select combobox as previous jobs. Users can search titles and acronyms, choose several suggestions, remove individual chips, or choose **Add “…”** for a custom entry. A missing catalog does not block custom entries. Confirmed selections remain local to the current tab. Names are stored with newline separators so commas in school or issuer names are preserved. Selections connect to programs, occupations, and skill suggestions; they do not grant skill ratings or verify credentials.

`public/background-options.json` contains:

- 6,064 distinct school/campus labels from [NCES IPEDS HD2024](https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip), covering U.S. colleges and training providers, with city/state and institutional aliases. The 2025 download was unavailable when checked; the interface explicitly labels this as 2024. Other schools/providers remain supported through custom entry.
- 6,319 distinct certification/issuer labels from [CareerOneStop’s July 2026 certification download](https://www.careeronestop.org/Developers/Data/certifications.aspx). Deleted/suppressed certifications and issuers are excluded. Certification and organization acronyms support search. The dropdown is not proof that a certification is current, held, or valid for a particular role.
- 216 names from [Wikidata’s hobby list](https://www.wikidata.org/wiki/Wikidata:List_of_activities_done_as_hobby), retrieved September 8, 2026. This is a community list with broad and niche activities, not an exhaustive hobby taxonomy. Structured Wikidata facts are CC0; attribution and a link are retained.

Run `python3 scripts/prepare_prefills.py /tmp/onet-prefill` to reproduce from cached snapshots or fetch missing public source files. The certification SQL export is parsed as text, never executed. The generated file includes source URLs and SHA-256 hashes. To refresh intentionally, replace the specific cached input, check its snapshot date and coverage, and rerun. A date assertion prevents silently labeling a newer certification download as July 2026. Source names, dates, scope, and counts are shown below the fields and in Data & methodology.

## Background connections

**View background connections** shows each entry → its source → suggested skills → related occupations. Users can edit or remove skill links, including for every custom entry, and restore automatic suggestions. All suggestions join the combined skills window with their provenance; background-derived skills start **Unrated**, with no assumed proficiency. Only rating/checking a skill includes it in alignment. Bulk acceptance remains limited to levels suggested by previous jobs. Removing an entry removes its unconfirmed suggestions; confirmed ratings remain user-owned.

- **Schools → fields and award levels:** [IPEDS C2024_A](https://nces.ed.gov/ipeds/datacenter/data/C2024_A.zip) supplies positive award records for 5,820 of the 6,064 school labels. Exact UNITID and six-digit CIP joins retain original award levels. Select a field you studied from a school's reported fields, or filter the major menu by all selected schools. The panel compares a selected major and education level to the school's 2024 record. These are historical awards, not current program availability, attendance verification, admissions requirements, or a school's prestige score. Missing records remain unknown.
- **Majors → occupations:** 2,325 six-digit fields from [NCES CIP 2020](https://nces.ed.gov/ipeds/cipcode/Files/CIPCode2020.csv); 1,906 have occupations in Atlas through the official [2020 CIP–2018 SOC crosswalk](https://nces.ed.gov/ipeds/cipcode/Files/CIP2020_SOC2018_Crosswalk.xlsx). Detailed SOC groups link to their O*NET specializations. A listed field prepares people for related work; it is not a mandatory degree for every employer or a placement probability.
- **Certifications → occupations:** 6,137 certification labels have active, direct (`RELATION=D`, `ACTIVE_YN=Y`) links from CareerOneStop's `CERT_ONET_ASSIGN` table to exact O*NET codes in Atlas. Indirect, inactive, and missing-code links are excluded. This does not establish licensure, credential validity, or universal employer requirements.
- **Interests → skills:** editable rules in `lib/background.ts` suggest O*NET skill vocabulary for 82 of the 216 catalog hobbies, plus recognized custom interests, talents, training, and athletic activities. This is an app-authored suggestion layer, not a validated research crosswalk. Remaining entries explicitly report no automatic mapping and support manual skill links. Physical-support notes are not analyzed.

Major/certification skill suggestions use four highly important skills and up to four distinctive skills across their linked roles (mean importance ≥2.5/5, distinctive relative to the measured occupation baseline). This is a suggestion from occupational demands, not a curriculum claim. Official occupation connections and similarity to linked skills replace generic word overlap as a final tie-breaker after path quality and confirmed skill fit. They never override pay/fit guardrails or exclude a role for an absent degree/credential connection. School names alone do not change rank.

`node tests/check.mjs` checks catalog validation, all occupation/program references, a real MIT → Computer Science → Software Developer chain, PMP occupation links, hobby skill provenance, manual/unmapped entries, removal, missing data, and separation from proficiency ratings.

## Broader profiles and fuzzy search

Previous jobs support multiple title selections. The **My skills** window compiles every reported positive skill level from those jobs alongside the user's own additions. Each skill appears once, showing all contributing jobs; its suggested level is the highest reported level, never a sum. Suggestions stay outside career scoring until checked, rated, or explicitly accepted together. Existing ratings, including zero, always win and remain when a job is removed. Unrated suggestions from removed jobs disappear when no remaining job supplies them.

The window also supports selecting and adding several skills together. New manual additions start at 3/7 for review, preserving any existing ratings. Editing skill ratings updates the map; learning scenarios remain separate. These entries remain local to the current tab.

Title search ranks canonical and alternate O*NET titles with installed cmdk's subsequence/transposition matching, plus a short trigram fallback for substitutions. Exact task text remains searchable. Database results preserve relevance order; occupation pickers show the nearest 50 matches. Deferred inputs keep typing responsive. This is local search, not an embedding service.

Education has distinct master’s, doctorate, and professional entries, all mapping to graduate preparation proxy 5. Major, training, hobbies, talents, and athletic experience use the connections described above. Entering a credential never automatically grants a skill rating or a license. Schools contribute program records; physical notes remain personal context, without prestige or medical scoring. Optional ability ratings use the O*NET 0–7 level scale; role demands more than 0.5 above a self-rating add a trade-off caution. Unknown ability data remains unknown, and accommodations/actual job conditions require review.

The possibility tree considers all 923 dataset roles across every activity group with no sampling cap, then excludes every known guardrail failure and every score below the shared minimum. Both 0–100 minimum fit sliders read and update `criteria.minFit`; changing either immediately updates the other and the results. The tree applies the score filter even to low-coverage scores; a separate checkbox includes or excludes unscored roles, but never restores a known pay, education, growth, or openings failure. Each surviving role shows its score, coverage, guardrail outcome, pay, and AI index. Education filters still apply. Adjust guardrails opens the shared controls without silently clearing them. Groups and their roles are ordered by highest fit, and a group selector plus native scrolling make the full tree navigable. It groups candidate outcomes, not sequential career transitions. Skill scenarios update its scores alongside the map.

## AI evidence and visualization

Research checked **September 8, 2026**. Sources and dates are visible in the application:

| Measure            | Source                                                                                                             | Mapped roles | Interpretation                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Observed exposure  | Massenkoff & McCrory, [Anthropic, March 5, 2026](https://www.anthropic.com/research/labor-market-impacts)          | 876          | Time-weighted task index combining theoretical LLM capability with measured professional Claude use, with more weight on automation. |
| AI applicability   | Tomlinson, Jaffe, Wang, Counts & Suri, [Working with AI v6, December 22, 2025](https://arxiv.org/abs/2507.07935v6) | 893          | Bing Copilot activity coverage, successful completion, and scope. Includes assistance, not just automation.                          |
| May usage patterns | [Anthropic June 26, 2026 Economic Index](https://www.anthropic.com/research/economic-index-june-2026-report)       | 718          | Global Claude chat/Cowork automation and augmentation shares within measured interactions associated with each role's tasks.         |

June 26 was the latest Economic Index release listed in the [official repository](https://huggingface.co/datasets/Anthropic/EconomicIndex/blob/main/README.md) when checked. Its April/May usage data is **not** an update to the March exposure index. Role details show May usage separately, preserving unpublished metrics. The March paper found no systematic increase in unemployment with exposure, with suggestive evidence of slower younger-worker hiring. Neither index estimates an individual's job-loss probability.

Node cores retain career fit/quality (or cluster/pay on the full map). Crimson arcs encode the selected AI index on a fixed 0–100 scale; tree branches also show a red segment proportional to the same index. Rings are emphasized from a user-adjustable threshold, initially 30/100. That cutoff is a visual preference, not a research-defined danger threshold. AI data does not reduce career scores, wages, or employment estimates. Gray dashed rings mean missing data; zero remains distinct. The two indices are not averaged or treated as comparable percentages or a time series.

Both occupation indices join **exact detailed SOC groups**, using the part before the O*NET specialization suffix. Specializations inherit the broader group's score; the source title/code is shown in details. May usage joins exact full O*NET codes. Fuzzy search is never used for data joins. These product-specific samples do not cover every AI product, employer, robot, or geographic market; low exposure is not proof of future safety.

Research snapshots are pinned in `scripts/prepare_enrichment.py`: Anthropic repository commit `2ea58ff75e4247d26810c37f10c179edc2466cac`; Microsoft commit `c94a07c52fb1d88ca5d221388f06d10e1bd6d2fe`. [Anthropic data](https://huggingface.co/datasets/Anthropic/EconomicIndex/tree/main/labor_market_impacts) and [Microsoft results](https://github.com/microsoft/working-with-ai) are used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Atlas adds joins, visualization, and career heuristics; the researchers have not endorsed these adaptations.

## Workspace layout and palette

The visualization is a background layer spanning the viewport between the navigation and footer. The header, profile, compensation controls, and legend float above it; a grid keeps the controls apart without enclosing the map in a tile. The cloud projects its normalized coordinates into the measured viewport, with a shared projection for points, links, and group labels. The small caption icons keep their own dimensions. The possibility tree uses a scrollable background with enough vertical space for every matching role; it does not shrink the whole tree to fit one screen. The palette uses a light neutral canvas, deep teal controls, contrasting earth-tone groups, and rust for AI exposure and weaker outcomes; pay uses a sequential green scale.
