# Proposal: Worker Daily Pay Tracking

## Intent

Track tenant-scoped attendance and informational accrual with an auditable monthly marker, independent of ledgers and Payroll.

## Scope

### In Scope
- Snapshot each explicit worked day's positive configured rate in Monday–Sunday weeks.
- Calculate informational accrual only from snapshots; never infer attendance.
- Keep one manual `PENDING|PAID` marker per organization, worker, and period with nullable `paidAt`. `PAID` stamps it and locks edits; revert clears it, unlocks, and is audited.
- Deny zero-day marking. Repeated same-state mark/revert is idempotent: state/timestamp stays unchanged and no audit is duplicated.
- Remove payment amounts/dates, partial payments, paid aggregates, balances, and overpayment semantics.

### Out of Scope
- Money transfer, providers, fiscal Payroll or its independent `paidAt`.
- Historical backfill and adjacent Payroll defects.

## Capabilities

### New Capabilities
- `worker-daily-pay-accrual`: Attendance, snapshots, accrued-only summaries, tenancy, and Payroll independence. **Rename:** replace draft `worker-daily-pay-ledger` and its spec path.
- `worker-daily-pay-month-control`: Monthly marker, locking, eligibility, audit, idempotency, and concurrency.

### Modified Capabilities
- None. No baseline capabilities exist under `openspec/specs/`.

## Approach

Keep worked-day rows and unique `DailyPayMonthControl`; remove `DailyPayPayment`. Hand-authored PostgreSQL migration SQL enforces `PAID ⇔ paidAt non-null`. Transition and audit run atomically under Serializable isolation with bounded retry. Tenant predicates remain mandatory; Payroll remains unrelated.

Before forward apply, remediate Units 1–4: reopen/replan 12 completed tasks into three ≤400-line Strict-TDD slices. Unit 4's size exception does not carry over.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20260902180000_add_worker_daily_pay/migration.sql` | Modified | Remove ledger; enforce marker invariant |
| `src/{lib,types,schemas,repositories}/daily-pay*` | Modified | Accrued-only contracts |
| daily-pay service, API, worker UI | Modified/New | Guarded transitions |
| `tests/unit/`, `tests/integration/` | Modified | Invariant, race, tenancy, Payroll proofs |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stale ledger semantics | High | Rename capability; stale-reference gate |
| Transition/audit divergence | Medium | Serializable atomic transaction, retry, unique row, `CHECK` |
| Payroll coupling | Medium | No FK/service reuse; regression tests |

## Rollback Plan

Before release, revert additive schema/migration, APIs, and UI together. After release, disable writes/UI, export marker/audit data, then reverse additive structures without altering Payroll.

## Dependencies

- Auth, membership, audit logging, Prisma 5.22, and PostgreSQL; no new package/provider.

## Success Criteria

- [ ] No payment-ledger model, API, DTO, aggregate, balance, or overpayment remains.
- [ ] Accrued totals equal worked-day snapshot sums; zero-day PAID is denied.
- [ ] PAID/revert locking, timestamps, audit, idempotency, and DB invariant pass tests.
- [ ] Same-tenant writes succeed; cross-tenant and `PLATFORM_ADMIN` bypass attempts fail; Payroll is unchanged.
- [ ] Twelve tasks are reopened and three ≤400-line Strict-TDD remediation slices pass before forward apply.
