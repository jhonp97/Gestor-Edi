# Downloadable monthly truck report

## Goal and authorization
User wants Generate Report to download an organized PDF, using their handwritten monthly grid as a reference: per-truck daily kilometers, workers and companies, daily expenses/income, followed by worker day counts and truck financial totals. No private screenshot data is copied into tests or records. User explicitly selected the accounting rules below.

## Accepted rules
- Finances belong to the truck: daily recorded movements and monthly income, expenses and result (income minus expenses). Do not allocate amounts to workers or infer wages.
- Per worker and truck: count distinct dates and show equivalent workdays from assigned percentages (50% = 0.5). Identify workers by ID, not name; a worker can appear on two trucks on the same date.
- Kilometers come ONLY from TruckMileage records. Never sum or substitute worker-day segment kilometers. Show missing mileage as no record rather than recorded zero.
- Include the complete selected month, independently of existing web detail pagination; allow selected truck or all organization trucks, separate clearly by truck.
- Preserve existing period/timezone conventions: financial instants in Europe/Madrid, civil work dates as recorded; verify mileage date semantics from existing repository/schema before implementation.

## Scope and constraints
- Add a PDF export loader/model, authenticated organization-scoped download route, PDF document, and visible monthly download action in the fleet report area.
- Keep existing paginated web reports and quarterly/half-year/year behavior intact; this download is explicitly monthly.
- Use current React PDF dependency and built-in fonts; no package installs, database schema changes, live DB/production operations or external uploads.
- Retrieve full month in deterministic bounded batches; if a safe export-size limit is needed, reject explicitly, never silently truncate.
- No worker DNI, passwords or other unnecessary private fields in the report.
- Preserve unrelated dirty work including payroll identity fix, pnpm files and R4 artifacts. No commit/push/merge.

## Tasks
- [x] M1 — Map data sources and clarify accounting/km/day rules. Scout muy2j26r-1z-oz66 plus parent readback complete; user selected all three rules above.
- [x] M2 — Implemented server-only `truck-monthly-export.ts`, PDF document and authenticated `/api/trucks/report/pdf` route plus monthly-only download anchor. Independent 200-row keyset batches fold all records; explicit 50,000-record guard rejects rather than truncates. Decimal-safe daily/truck totals, per-worker distinct dates/share equivalents and only civil-date TruckMileage distances. Writer observed RED then **34/34 GREEN**, scoped lint, full nonincremental TypeScript and diff checks passing; synthetic real multipage PDF render passed. Eight-file change reported as 404 added lines, acknowledged rather than compressed.
- [x] M3 — Independent verifier `muy3i98s-21-zrm5` returned **CLEAR** with **34/34** focused tests and **24/24** existing report regressions, full nonincremental TypeScript and eight-path ESLint passing. Scoped diff check had no whitespace errors (CRLF warnings; untracked contents not covered by git diff). Real synthetic render checks PDF signature/size/multiple pages, not extracted text or visual clipping. No browser/live DB verification.

- [x] M4 — Removed all three technical paragraphs. Added dedicated per-truck summary pages with 20pt kilometer/expense/income figures, highlighted Balance del mes with textual positive/negative/zero status, and 11pt alternating worker-table rows. Preserved all original numerical strings, missing-vs-zero distinction and daily detail. Only PDF document and focused test changed.
- [x] M5 — Initial M4 source/test review **CLEAR**; 19/19 focused document/API tests, TypeScript and scoped ESLint passed. Parent strengthened per-truck sign assertions. First 90-worker/two-truck synthetic extraction found worker-table headings only twice, despite continuation pages. Parent then split worker list to dedicated per-truck pages and rerendered.
- [x] M6 — Split financial totals/balance and worker list onto distinct per-truck pages. Worker pages have fixed month/truck title and column headings at the top with reserved padding; worker columns use contained widths; empty-state and row data preserved. Added regression that each truck gets a separate worker page with fixed header. RED observed first: expected6 page components but got4 before source edit; GREEN thereafter.
- [x] M7 — Parent directly reviewed final source/tests after user requested no further subagent work. Final six-suite report run **61/61**, full nonincremental TypeScript and scoped ESLint all passed. Synthetic PDF renders: 16 pages with two trucks/90 workers, all headings/totals/90 names/31 dates; repeated worker title+columns on all8 summary pages. A separate 60-worker raw-order extraction associated all60 names with their correct 31-day/equivalent values and all5 worker-page headers. `pdftotext -layout` spatial grouping had misleading separate-line placement for last column, but raw reading order confirmed correct row association. Temporary test/PDF/browser files were removed. Xpdf lacks bbox-layout; headless Chromium could not load its PDF plugin, so no visual screenshot/clipping check is available. Three independent subagent review attempts failed at the agent level; do not claim final independent review after M6. Only manual visual acceptance by user remains.

## Acceptance and checks
- Detail includes all records beyond the 50-row web page boundary, correct month boundaries and no cross-organization rows.
- Days combine operational data and financial/mileage dates without multiplying amounts for multiple workers or companies.
- All calendar dates may be listed or dates with recorded activity, but missing categories on a shown date must be labeled honestly.
- Worker summaries deduplicate same worker/date and retain percentage equivalents; duplicate worker names remain distinct identities internally.
- Totals retain Decimal-safe money arithmetic; result is explicitly recorded income minus recorded expense, not inferred accounting profit.
- PDF contains readable headings, ordered dates, distinct truck sections, multipage support, repeated worker-table headings and correct worker/day/equivalent associations; visual user acceptance remains pending.
- Auth/input validation rejects missing session/org, invalid month and inaccessible truck; no DB or render on early rejection where applicable.
- Tests synthetic only; real renderer check does not access DB or network and must not imply browser verification.

## Progress and next step
Parent implementation and checks are complete. Final evidence: six focused report suites **61/61**, `tsc --noEmit --incremental false`, scoped ESLint, synthetic multipage render and synthetic `pdftotext -raw` row-association checks passed. No live DB/network/production data. Independent review of M6/M7 could not be obtained because verifier and scout subagent invocations failed; parent inspected source and checks directly, and does not claim new independent CLEAR. Headless Chromium reported `Couldn't load plugin`; visual rendering/clipping cannot be verified by this headless harness. User retest: with `pnpm dev`, open Generate Report, choose a month and one/all trucks, apply Ver informe, click Descargar PDF mensual; inspect large totals/balance, worker names/days/equivalents and continuation page headings. Quarterly/half-year/year views intentionally hide this monthly download. Export covers full month regardless of cursors; concurrent DB edits are not snapshot-isolated. No commit/push/merge/production operations. Earlier manual confirmation applies to payroll list only and does not resolve separate R3/R4 merge gates.

## Merge-preparation follow-up
The owner later explicitly authorized work-unit commits and a push if needed for merge preparation; earlier no-commit text documents the original session. On the current tree a fresh six-file synthetic report run passed **61/61 tests** with database-enabling variables removed (`MONTHLY_EXIT=0`), alongside nonincremental TypeScript and repository-wide ESLint exit 0. The exporter/model test were committed as `df66203`, followed by PDF document/render test as `3c142cc`; this final monthly download route/UI/test/task-record slice depends on both. No browser visual acceptance, real DB export, build or CI is implied. The user still needs to inspect a newly downloaded PDF for final visual acceptance.
