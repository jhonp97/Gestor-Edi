# Design: Worker Daily Pay Tracking

## Technical Approach

Remediate the untracked candidate before forward work. Retain tenant-scoped day snapshots and exact Decimal accrual; replace ledger/closure behavior with the specifications' single monthly marker. Fiscal Payroll remains unreferenced.

## Architecture Decisions

| Choice | Alternatives considered | Rationale |
|---|---|---|
| `DailyPayMonthControl(status, paidAt)` is truth; `AuditLog` is history | Ledger; separate marker/lock | One row matches the product and eliminates amount/partial/balance/overpayment semantics. |
| Unique tenant-worker-period row; three-attempt Serializable retry for Prisma `P2034`/SQLSTATE `40001` | Application mutex; unbounded retry | The database serializes transitions/day edits; same-state paths write nothing. |
| Repository requires `organizationId` on every predicate | Optional scope; role bypass | Cross-tenant IDs, including `PLATFORM_ADMIN`, resolve as not found. |
| Amend the pending migration in place | Destructive follow-up | Change files are untracked/pre-release; only disposable databases received the migration. |

## State Machine and Data Flow

```text
PENDING/null -- mark-paid [worked-day count >= 1] --> PAID/T (lock days, audit)
PAID/T ------ revert [reason?] -------------------> PENDING/null (unlock, audit T)
same-state command --------------------------------> unchanged 200 (no audit)

UI -> Route(auth/org) -> Service -> retry -> Serializable transaction
  -> tenant repository -> unique control + day count -> state + AuditLog atomically
```

Day edits use that transaction/control; `PAID` conflicts before writing. Accrued is recomputed from snapshots and never qualifies a transition.

## Database and Migration

Prisma retains `DailyPayDay`, nullable positive `Worker.dailyRate`, and `DailyPayMonthControl`; remove `DailyPayPayment` and inverse relations. Add `PENDING|PAID` and `paidAt DateTime?`. Hand-author in `20260902180000_add_worker_daily_pay/migration.sql`:

```sql
CONSTRAINT "daily_pay_month_status_paid_at_consistency" CHECK (
  ("status" = 'PAID' AND "paidAt" IS NOT NULL) OR
  ("status" = 'PENDING' AND "paidAt" IS NULL)
)
```

Remove payment table/index/FK DDL; create enum `('PENDING','PAID')`, default `PENDING`, add `paidAt`, and rename audit values. First fingerprint the approved remote read-only target and require `SELECT to_regclass('public."DailyPayPayment"') IS NULL;` = true; uncertainty/false stops rollout. No backfill or flag.

## Interfaces and Contracts

```ts
type DayDTO = { date: CivilDate; rateSnapshot: Money }
type MonthDTO = { workerId: string; periodStart: CivilDate; dailyRate: Money|null;
  status: 'PENDING'|'PAID'; paidAt: string|null; days: DayDTO[];
  totals: { accrued: Money } }
type YearDTO = { year: number; months: (Pick<MonthDTO,'periodStart'|'status'|'paidAt'>
  & { accrued: Money })[] }
```

Zod retains strict civil-date, month-start, canonical-money, and positive-rate validation; removes payments; adds strict `{}` mark-paid, `{reason?: non-empty string}` revert, and nullable ISO-datetime `paidAt`. History returns twelve ordered months; absent months are synthesized `PENDING/null/0.00` without writes.

Repository removes payment methods and makes day/count/control operations transaction-scoped. Service locks without changing timestamps, requires one day, stamps/clears `paidAt`, and injects `tx` into `AuditLogRepository`. Actions: `DAILY_PAY_MONTH_MARKED_PAID` / `DAILY_PAY_MONTH_MARKED_PENDING`; audit columns hold actor/tenant/time, details hold worker, period, transition, previous/new `paidAt`, and optional sanitized reason.

Routes: `GET|PATCH /api/workers/[id]/daily-pay?periodStart=...`; `PUT|DELETE .../days/[date]`; `GET .../daily-pay/history?year=...`; `POST .../months/[periodStart]/mark-paid`; `POST .../months/[periodStart]/revert`. Return 200; new day 201; delete 204; malformed 400; unauthenticated 401; missing/cross-tenant 404; locked/empty/duplicate/retry-exhausted 409; sanitized unexpected 500. No payment route.

UI: no-rate guidance; editable empty/eligible `PENDING`; zero-day mark disabled; locked `PAID` with `paidAt`; optional-reason revert; accrued-only history. Payroll UI/state stays unchanged.

## File Changes

| Files | Action | Scope |
|---|---|---|
| `prisma/schema.prisma`; `prisma/migrations/20260902180000_add_worker_daily_pay/migration.sql` | Modify | Remove payment DDL; add marker invariant/audits. |
| `src/lib/daily-pay.ts`; `src/types/daily-pay.ts`; `src/schemas/daily-pay.schema.ts` | Modify/retain | Keep rate/date/week/exact-sum; expose accrued-only contracts. |
| `src/repositories/daily-pay.repository.ts`; `tests/unit/lib/daily-pay.test.ts`; `tests/unit/repositories/daily-pay.repository.test.ts`; `tests/integration/daily-pay-concurrency.test.ts` | Modify | Remove payments; add marker/tenant/race proofs. |
| `src/app/api/workers/[id]/daily-pay/payments/route.ts` | Remove from plan/never create | No payment model, relation, method, DTO, command, aggregate, route, or test. |
| `src/repositories/audit-log.repository.ts`; `src/schemas/audit.schema.ts` | Future modify | Transaction client/actions. |
| `src/services/daily-pay.service.ts`; `src/app/api/workers/[id]/daily-pay/{route.ts,history/route.ts,days/[date]/route.ts,months/[periodStart]/{mark-paid,revert}/route.ts}`; `src/components/workers/daily-pay/{daily-pay-panel,daily-pay-calendar}.tsx`; `src/app/(app)/workers/[id]/page.tsx`; future daily-pay service/API/UI/E2E tests | Future create/modify | Service, routes, state UI, tests. |

## Testing and Remediation

Reopen `1.1,1.1a,1.2,1.3,1.3a,1.3b,1.4,1.4a,1.4b,2.1,2.3,2.5b`. Before Unit 5, run ≤400-line Strict-TDD slices: R1 schema/migration/CHECK/disposable PostgreSQL; R2 accrued helper/DTO/Zod; R3 repository/removal/marker round trips. Unit 4's exception does not carry. Forward RED tests cover zero-day denial, same-state no-op, timestamp/audit atomicity, races/retry exhaustion, tenancy, history, and Payroll independence.

## Threat Matrix

| Boundary | Applicability | Safe/failure behavior and planned RED test |
|---|---|---|
| Prisma/Docker subprocess harness | Applicable | `TM-PROC`: copy Prisma inputs to an `.env`-free temporary cwd; fixed argv gets explicit `DATABASE_URL`/`DIRECT_URL` and a disposable fingerprint. RED: repository `.env` trap, missing/mismatched URLs, uncertain/non-disposable target, forced failure. Doubt means no DDL; always clean temp/container/database resources. Tasks copy `TM-PROC` unchanged. |
| Documentation-like paths | N/A | No executable classification/command routing; HTTP routes are API adapters. |
| Git repository selection | N/A | No Git subprocess. |
| Commit state | N/A | No commit automation. |
| Push state | N/A | No push automation. |
| PR commands | N/A | No PR automation. |

## Risks

Stale ledger surfaces, audit divergence, unsafe DB targeting, and Payroll coupling are release gates.

## Open Questions

None.
