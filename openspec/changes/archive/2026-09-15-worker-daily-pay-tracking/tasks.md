# Tasks: Worker Daily Pay Tracking

## Review Workload Forecast

Estimated changed lines: 2,100–2,450 physical incl code/tests/task-progress metadata.
400-line budget risk: High
Chained PRs recommended: Yes
Suggested split: R1→R2→R3→F4→F5→F6→F7; each <400; size:exception excluded.
Delivery strategy: ask-on-risk.
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

`DB-H`: Windows `pwsh -NoProfile -Command` from `.env`-free temp cwd; explicitly set `DATABASE_URL`+`DIRECT_URL`; run `node_modules\.bin\prisma.CMD migrate deploy`/Docker; disposable fingerprint + `SELECT to_regclass('public."DailyPayPayment"') IS NULL`; mask credentials; stop/no DDL; `finally` clean temp/container/database.

### Suggested Work Units

|U|Scope; phys incl tests+progress|Base|Focused|Runtime|Rollback|
|---|---|---|---|---|---|
|R1|schema/CHECK/migration; 330|PR1=`feature/tracker`|`node_modules\.bin\vitest.CMD run --pool=threads tests/integration/daily-pay-concurrency.test.ts`|DB-H identity/failure/cleanup|`prisma/schema.prisma`,`prisma/migrations/20260902180000_add_worker_daily_pay/migration.sql`,`tests/integration/daily-pay-concurrency.test.ts`|
|R2|lib/types/Zod; 290|PR2=PR1 branch|`node_modules\.bin\vitest.CMD run --pool=threads tests/unit/lib/daily-pay.test.ts`|N/A—pure contracts|`src/lib/daily-pay.ts`,`src/types/daily-pay.ts`,`src/schemas/daily-pay.schema.ts`,`tests/unit/lib/daily-pay.test.ts`|
|R3|repository/DB; 350|PR3=PR2 branch|`node_modules\.bin\vitest.CMD run --pool=threads tests/unit/repositories/daily-pay.repository.test.ts tests/integration/daily-pay-concurrency.test.ts`|DB-H marker/tenant/race|`src/repositories/daily-pay.repository.ts`,`tests/unit/repositories/daily-pay.repository.test.ts`,`tests/integration/daily-pay-concurrency.test.ts`|
|F4|service/audit; 360|PR4=PR3 branch|`node_modules\.bin\vitest.CMD run --pool=threads tests/unit/services/daily-pay.service.test.ts tests/integration/daily-pay-concurrency.test.ts`|DB-H transition/audit/retry|`src/services/daily-pay.service.ts`,`src/repositories/audit-log.repository.ts`,`src/schemas/audit.schema.ts`,`tests/unit/services/daily-pay.service.test.ts`,`tests/integration/daily-pay-concurrency.test.ts`|
|F5|HTTP; 320|PR5=PR4 branch|`node_modules\.bin\vitest.CMD run --pool=threads tests/unit/api/daily-pay.routes.test.ts`|`node_modules\.bin\playwright.CMD test tests/e2e/daily-pay-api.spec.ts`|`src/app/api/workers/[id]/daily-pay/route.ts`,`src/app/api/workers/[id]/daily-pay/history/route.ts`,`src/app/api/workers/[id]/daily-pay/days/[date]/route.ts`,`src/app/api/workers/[id]/daily-pay/months/[periodStart]/mark-paid/route.ts`,`src/app/api/workers/[id]/daily-pay/months/[periodStart]/revert/route.ts`,`tests/unit/api/daily-pay.routes.test.ts`,`tests/e2e/daily-pay-api.spec.ts`|
|F6|UI/calendar/history; 300|PR6=PR5 branch|`node_modules\.bin\vitest.CMD run --pool=threads tests/unit/components/daily-pay-panel.test.tsx`|`node_modules\.bin\playwright.CMD test tests/e2e/daily-pay.spec.ts`|`src/components/workers/daily-pay/daily-pay-panel.tsx`,`src/components/workers/daily-pay/daily-pay-calendar.tsx`,`src/app/(app)/workers/[id]/page.tsx`,`tests/unit/components/daily-pay-panel.test.tsx`,`tests/e2e/daily-pay.spec.ts`|
|F7|integration/verification; 220|PR7=PR6 branch|`node_modules\.bin\vitest.CMD run --pool=threads tests/unit tests/integration/daily-pay-concurrency.test.ts`|DB-H + `node_modules\.bin\playwright.CMD test tests/e2e/daily-pay-api.spec.ts tests/e2e/daily-pay.spec.ts`; cleanup|`tests/integration/daily-pay-concurrency.test.ts`,`tests/e2e/daily-pay-api.spec.ts`,`tests/e2e/daily-pay.spec.ts`,`openspec/changes/worker-daily-pay-tracking/tasks.md`|

## Phase 1: Remediation — Foundation

- [x] 1.1 **R1 RED** `tests/integration/daily-pay-concurrency.test.ts`: no `DailyPayPayment`; PENDING/PAID+paidAt+CHECK; positive rate; Payroll.
- [x] 1.1a **R1 RED/TM-PROC** `tests/integration/daily-pay-concurrency.test.ts`: wrong DB target/.env override; credential non-disclosure; subprocess failure; cleanup; stop/no DDL.
- [x] 1.2 **R1 GREEN** `prisma/schema.prisma`,`prisma/migrations/20260902180000_add_worker_daily_pay/migration.sql`: remove model/relations/DDL; add PENDING/PAID+paidAt+hand-authored CHECK; in-place migration.
- [x] 1.3 **R2 RED** `tests/unit/lib/daily-pay.test.ts`: snapshots, civil dates, Monday–Sunday, exact accrued-only sums.
- [x] 1.3a **R2 RED** `tests/unit/lib/daily-pay.test.ts`: Month/Year DTO; mark `{}`; revert `{reason?}`; paidAt ISO; absent months.
- [x] 1.3b **R2 GREEN** `src/types/daily-pay.ts`,`src/schemas/daily-pay.schema.ts`: accrued-only DTO/Zod; retain positive daily-rate; remove recordPayment.
- [x] 1.4 **R2 REFACTOR** `src/lib/daily-pay.ts`: exact accrued helper; snapshot/date/week invariants.
- [x] 1.4a **R2 REFACTOR** `tests/unit/lib/daily-pay.test.ts`: valid/invalid rate-date; exact-total regressions.
- [x] 1.4b **R2 REFACTOR** `src/schemas/daily-pay.schema.ts`: strict status/commands/history; nullable ISO timestamp.

## Phase 2: Repository and Service

- [x] 2.1 **R3 RED** `tests/unit/repositories/daily-pay.repository.test.ts`,`tests/integration/daily-pay-concurrency.test.ts`: no payment methods; marker primitives; unique tenant key.
- [x] 2.2 **R3 RED** `tests/unit/repositories/daily-pay.repository.test.ts`,`tests/integration/daily-pay-concurrency.test.ts`: tenant/role bypass; PENDING default; idempotency; mutex/Serializable.
- [x] 2.3 **R3 GREEN** `src/repositories/daily-pay.repository.ts`: remove payment methods; tenant marker/day/count transaction primitives.
- [x] 2.3a **R3 REFACTOR** `tests/unit/repositories/daily-pay.repository.test.ts`: PAID paid-day-edit lock; state/paidAt round trips; predicates.
- [x] 2.4 **R3 REFACTOR** `tests/integration/daily-pay-concurrency.test.ts`: disposable DB exact accrual/marker race/cleanup/Payroll.
- [x] 2.5 **F4 RED** `tests/unit/services/daily-pay.service.test.ts`: mark/revert; ≥1 worked-day guard; no-op; paidAt; lock.
- [x] 2.5a **F4 RED** `tests/unit/services/daily-pay.service.test.ts`,`tests/integration/daily-pay-concurrency.test.ts`: atomic audit; bounded retry/concurrency; race; failed-no-audit; tenant/role bypass.
- [x] 2.5b **F4 GREEN** `src/services/daily-pay.service.ts`,`src/repositories/audit-log.repository.ts`,`src/schemas/audit.schema.ts`: atomic `DAILY_PAY_MONTH_MARKED_PAID`/`DAILY_PAY_MONTH_MARKED_PENDING`, actor/tenant/time/details, tx, sanitized reason.
- [x] 2.5c **F4 REFACTOR** `tests/unit/services/daily-pay.service.test.ts`,`tests/integration/daily-pay-concurrency.test.ts`: no-op timestamp/audit; Payroll independence.

## Phase 3: HTTP and UI

- [x] 3.1 **F5 RED** `tests/unit/api/daily-pay.routes.test.ts`: auth/tenant/role/validation/status; no payments endpoint.
- [x] 3.1a **F5 RED** `tests/e2e/daily-pay-api.spec.ts`: awaited params; 200/201/204/400/401/404/409/500; sanitized errors; real API.
- [x] 3.2 **F5 GREEN** `src/app/api/workers/[id]/daily-pay/route.ts`,`src/app/api/workers/[id]/daily-pay/history/route.ts`,`src/app/api/workers/[id]/daily-pay/days/[date]/route.ts`,`src/app/api/workers/[id]/daily-pay/months/[periodStart]/mark-paid/route.ts`,`src/app/api/workers/[id]/daily-pay/months/[periodStart]/revert/route.ts`: create handlers; assert `src/app/api/workers/[id]/daily-pay/payments/route.ts` (read-only) absent.
- [x] 3.2a **F5 REFACTOR** `src/app/api/workers/[id]/daily-pay/route.ts`: await Promise params; safe errors/statuses.
- [x] 3.3 **F6 RED** `tests/unit/components/daily-pay-panel.test.tsx`,`tests/e2e/daily-pay.spec.ts`: Pending/Paid; paidAt; no-rate/zero-day; accessibility; Payroll.
- [x] 3.4 **F6 GREEN** `src/components/workers/daily-pay/daily-pay-panel.tsx`,`src/components/workers/daily-pay/daily-pay-calendar.tsx`,`src/app/(app)/workers/[id]/page.tsx`: calendar/history/locks/accessibility; Payroll unchanged.

## Phase 4: Verification

- [x] 4.1 **F7 RED** `tests/integration/daily-pay-concurrency.test.ts`,`tests/e2e/daily-pay-api.spec.ts`,`tests/e2e/daily-pay.spec.ts`: annual history; marker/accrual; tenancy; concurrency; Payroll.
- [x] 4.2 **F7 GREEN** `tests/integration/daily-pay-concurrency.test.ts`,`tests/e2e/daily-pay-api.spec.ts`,`tests/e2e/daily-pay.spec.ts`: Vitest/E2E matrix; record results.
- [x] 4.3 **F7 VERIFY** `node_modules\.bin\prisma.CMD validate`,`node_modules\.bin\eslint.CMD .`,`node_modules\.bin\tsc.CMD --noEmit`: record failures.
