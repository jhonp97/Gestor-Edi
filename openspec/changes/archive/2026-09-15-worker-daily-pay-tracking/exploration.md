## Exploration: Worker Daily Pay Tracking

Recommended model: an additive three-table daily-pay ledger (per-day worked records + payment ledger + explicit monthly closure) that is fully independent of the fiscal Payroll module. All findings below were re-verified against the current codebase on 2026-09-02.

### Current State

- **Workers are tenant-scoped** by `organizationId`. `/workers/[id]/page.tsx` loads the worker with `prisma.worker.findFirst({ where: { id, organizationId } })` and renders a "Nóminas Recientes" placeholder card — the natural host for a daily-pay section.
- **WorkerTable does not link worker names** (`worker-table.tsx` renders the name as plain text); the only navigation to `/workers/[id]` is the "Ver detalles" icon button.
- **Worker has no daily-rate field**; only `baseSalary Float` exists (fiscal).
- **Payroll is fiscal and must stay untouched**: stores `month/year`, IRPF/SS/deductions, `grossPay`, `netPay`, and a nullable `paidAt`. `markAsPaid` only stamps `paidAt` — **no actual paid amount is recorded anywhere**.
- **Payroll formula is duplicated in 4 places**: `PayrollService.calculatePayroll`, `src/app/api/payroll/generate/route.ts`, `src/app/api/payroll/individual/route.ts`, and `prisma/seed.ts` (`calcPayroll`). Out of scope; flagged as a nearby hazard.
- **Verified tenant-safety hole nearby**: `src/app/api/nomina/[id]/pdf/route.tsx` has **no auth check and constructs `new PayrollRepository()` with no `organizationId`**, so `tenantFilter()` returns `{}` and any payroll PDF is fetchable by ID. Out of scope for this change; must be reported separately.
- **Transaction is truck-bound** (`truckId` required, cascade) — not a usable worker payment ledger.
- **Multi-tenancy pattern**: `BaseRepository.tenantFilter()` + `getUserFromRequest()` (from `@/lib/auth-edge`). Note: `tenantFilter()` silently returns `{}` when constructed without an organizationId — new repositories must always be constructed scoped.
- **Authorization today**: worker PATCH/DELETE only check organization membership — **no role check** (any org member can write). Introducing role-gated writes for daily pay would be a new, deeper convention: a product decision for the proposal phase.
- **Audit** exists as `AuditLog` (Prisma) + `auditService.log`, with **two parallel action enums to extend**: Prisma `enum AuditAction` (schema.prisma) and Zod `AuditActionSchema` (`src/schemas/audit.schema.ts`). Both currently have 8 actions, none daily-pay related.
- **In-repo precedent for per-day records**: `TruckMileage` — one row per truck per civil date, `@db.Date`, `@@unique([truckId, date])`, org-scoped, indexed. The daily-pay record model can mirror it exactly.
- **Money is `Float` everywhere today** with `Math.round(x * 100) / 100` guards. Database is **PostgreSQL** (`provider = "postgresql"`), so `Decimal @db.Decimal(10, 2)` is supported for the new ledger.
- **No date library** in `package.json`; dates use native `Date` and `input type="date"`. Stack: Next 16.2.2, React 19, Prisma 5.22, Zod 4, Vitest 4, Playwright, `@ducanh2912/next-pwa`, pnpm.
- **Types**: `src/types/index.ts` re-exports `Worker` directly from `@prisma/client`; `CreateWorkerInput`/`UpdateWorkerInput` are Omit-derived from it, so a new optional `dailyRate` column flows into existing input types automatically.
- **Tests**: Vitest unit suites exist per repository and service (`tests/unit/repositories/`, `tests/unit/services/`) plus schema-level DB tests (`tests/unit/db/`, e.g. `audit-log-model.test.ts`) — both patterns to follow. No daily-pay code exists anywhere in `src/` (grep-verified; greenfield).
- **OpenSpec housekeeping**: `openspec/config.yaml` and `openspec/specs/` do not exist yet (sdd-init artifacts missing). Store mode remains openspec as dictated by the orchestrator. Spec conventions visible in the sibling `truck-mileage` change: `FR-XXX: name (Must)` headings with GIVEN/WHEN/THEN scenarios.

### Affected Areas

| Path | Impact | Why |
|------|--------|-----|
| `prisma/schema.prisma` | Modified | Optional `dailyRate` on `Worker`; new `DailyPayRecord`, `DailyPayPayment`, `WorkerDailyPayClosure` models; extend Prisma `enum AuditAction`. |
| `src/schemas/index.ts` | Modified | Zod schemas for daily-rate update, day records, payments, closure/reopen. |
| `src/schemas/audit.schema.ts` | Modified | Extend Zod `AuditActionSchema` with daily-pay actions (in parallel with the Prisma enum). |
| `src/types/index.ts` | Modified | New `DailyPayRecord`, `DailyPayPayment`, `DailyPaySummary` types (worker dailyRate flows automatically). |
| `src/repositories/daily-pay.repository.ts` | New | Tenant-scoped CRUD for day records, payments, closure checks, aggregates. |
| `src/services/daily-pay.service.ts` | New | Accrual, payment application, settlement, closure validation, summaries. |
| `src/app/api/workers/[id]/route.ts` | Modified | Accept `dailyRate` in PATCH (same pattern as `baseSalary`); include in GET. |
| `src/app/api/workers/[id]/daily-pay/...` | New | Endpoints: save day/week, record payment, settle, close month, reopen month. |
| `src/app/(app)/workers/[id]/page.tsx` | Modified | Daily-pay section replacing/next to the "Nóminas Recientes" placeholder. |
| `src/components/workers/worker-table.tsx` | Modified | Make worker name a `Link` to `/workers/[id]`. |
| `src/components/workers/worker-edit-form.tsx` | Modified | Optional `dailyRate` input. |
| `src/components/daily-pay/*` | New | Week selector (Mon–Sun), payment form, settlement, reopen, summary cards. |
| `tests/unit/repositories/daily-pay.repository.test.ts` | New | Repository mocks + tenant-isolation tests (follow `worker.repository.test.ts`). |
| `tests/unit/services/daily-pay.service.test.ts` | New | Accrual, payment, closure, aggregate tests. |
| `tests/unit/db/` | New file(s) | Model/schema tests (follow `audit-log-model.test.ts` precedent). |

### Approaches

1. **Explicit monthly closure entity (recommended)** — three single-responsibility tables: `DailyPayRecord` (one row per worked day; unmarked day = no row), `DailyPayPayment` (one row per cash movement, supports partials), `WorkerDailyPayClosure` (one row per worker/month; the authoritative lock; reopen mutates the closure row, never payments).
   - Pros: directly implements audited reopen; durable, race-safe lock via `@@unique([workerId, year, month])`; payments stay immutable ledger rows; "fully paid" and "locked" are independent states; summaries derived from authoritative data.
   - Cons: one extra table; read-time aggregation (mitigated by ≤ 31 rows/worker/month).
   - Effort: Medium
   - Evidence: mirrors the proven `TruckMileage` per-civil-date pattern already in this schema.

2. **Payment-balance closure (minimal table count)** — only records + payments; a month is "closed" when `totalPaid >= accrued` with a `settledAt` flag on the latest payment; reopening mutates or deletes that payment.
   - Pros: fewer tables; closure derived from data.
   - Cons: cannot distinguish "fully paid" from "explicitly locked"; reopening destroys ledger history (violates audit requirement); settlement races harder to guard without a dedicated unique constraint.
   - Effort: Low for happy path, High to meet locking/audit requirements.

### Recommendation

**Approach 1: explicit monthly closure entity.**

```prisma
model Worker {
  // ... existing fields
  dailyRate        Decimal?                @db.Decimal(10, 2)
  dailyPayRecords  DailyPayRecord[]
  dailyPayPayments DailyPayPayment[]
  dailyPayClosures WorkerDailyPayClosure[]
}

model DailyPayRecord {
  id             String       @id @default(uuid())
  workerId       String
  worker         Worker       @relation(fields: [workerId], references: [id], onDelete: Cascade)
  date           DateTime     @db.Date
  value          Decimal      @db.Decimal(10, 2)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([workerId, date])
  @@index([workerId])
  @@index([date])
  @@index([organizationId])
}

model DailyPayPayment {
  id             String       @id @default(uuid())
  workerId       String
  worker         Worker       @relation(fields: [workerId], references: [id], onDelete: Cascade)
  date           DateTime     @db.Date
  amount         Decimal      @db.Decimal(10, 2)
  note           String?
  isSettlement   Boolean      @default(false)
  createdAt      DateTime     @default(now())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([workerId])
  @@index([date])
  @@index([organizationId])
}

model WorkerDailyPayClosure {
  id               String       @id @default(uuid())
  workerId         String
  worker           Worker       @relation(fields: [workerId], references: [id], onDelete: Cascade)
  year             Int
  month            Int
  closedAt         DateTime     @default(now())
  closedByUserId   String
  reopenedAt       DateTime?
  reopenedByUserId String?
  reopenedReason   String?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([workerId, year, month])
  @@index([workerId])
  @@index([year, month])
  @@index([organizationId])
}
```

Key design decisions to carry into proposal/design:

- **Decimal money for the new ledger** (`Decimal @db.Decimal(10, 2)`): the ledger drives `pending = accrued - paid` and closure state, so float rounding is unacceptable. PostgreSQL supports it. Tradeoff to pin in design: serialization (Decimal → string in JSON) and inconsistency with the legacy Float fields; an Int-cents alternative exists but diverges more from domain readability.
- **Civil dates as `@db.Date`**: parse incoming `"YYYY-MM-DD"` as UTC midnight so Spain timezone offsets cannot shift the day (same as `TruckMileage`).
- **Week view Mon–Sun** with native `Date` helpers (Monday = `(day + 6) % 7`); no new date dependency.
- **Unmarking a day deletes its `DailyPayRecord`** — no negative rows.
- **Locking**: every write for `(workerId, year, month)` checks `WorkerDailyPayClosure` inside a Prisma transaction; 409 if closed. Closure unique constraint prevents duplicate closure rows.
- **Reopening** sets `reopenedAt/reopenedByUserId/reopenedReason` on the existing closure row; prior payments are never rewritten.
- **Authorization**: reuse `getUserFromRequest`; all repositories constructed with the session's `organizationId`. Open decision for proposal: whether writes require `ORG_ADMIN` (today's worker endpoints accept any org member — introducing role checks is a new convention).
- **Audit**: add `DAILY_PAY_DAY_SAVED`, `DAILY_PAY_PAYMENT_RECORDED`, `DAILY_PAY_SETTLEMENT`, `DAILY_PAY_MONTH_CLOSED`, `DAILY_PAY_MONTH_REOPENED` to **both** the Prisma `enum AuditAction` and Zod `AuditActionSchema`; log actor, organization, worker, and month.
- **Migration/back-compat**: `dailyRate` nullable (defaults null); new tables start empty; Payroll untouched; no historical worked-day inference — only explicitly entered days accrue.

### Risks

- **Pre-existing tenant-safety hole in the payroll PDF route** (no auth, no org scoping) is adjacent to this work. Must not be silently folded into this change; report it as its own issue.
- **Payroll formula duplication (4 sites)** is a nearby hazard; this change must stay independent and not drift into payroll cleanup.
- **`BaseRepository.tenantFilter()` returns `{}` when unscoped** — a forgotten constructor argument silently disables tenancy. New repository tests must assert isolation explicitly.
- **Float/Decimal inconsistency** in serialization and test fixtures once the ledger uses Decimal.
- **Timezone boundaries**: week and month bucketing must be explicit; `YYYY-MM-DD` parsed as UTC midnight.
- **Concurrency on settlement/reopen**: guard with the closure unique constraint + transactional check-then-write; consider an idempotency key for settlement.
- **Review budget (400 lines) will be exceeded**: schema + repo + service + routes + UI + tests. Tasks phase must forecast High and recommend chained PRs (delivery strategy `ask-on-risk`).
- **OpenSpec housekeeping**: `openspec/config.yaml` and `openspec/specs/` are missing; downstream phases (spec/archive) assume them.

### Ready for Proposal

Yes. The orchestrator can tell the user that exploration is complete and re-verified against current code: the recommended approach is the explicit monthly closure entity with per-day records, a separate payment ledger, and Decimal money on PostgreSQL. Next step is `sdd-propose`; the proposal should pin the authorization depth (role-gated writes or parity with today's membership-only checks) and the chained-PR delivery recommendation.

---

# AMENDMENT 1 — 2026-09-03: Payment Ledger Removed, Monthly Pending/Paid Marker

> **Status**: Planning-only amendment. Supersedes every payment-amount finding of the original exploration above (preserved verbatim for history). Driven by a user-confirmed product correction recorded in memory (`#1694`, 2026-09-02) and re-confirmed by the orchestrator on 2026-09-03. All claims below were re-verified against the worktree on 2026-09-03 (CodeGraph + direct reads + `git status`). No proposal, spec, design, task, apply-progress, or code file was modified by this amendment.

## Confirmed Product Correction (decisions — no blockers remain)

1. This feature does **not** transfer money and does **not** integrate any payment provider. No external payment gateway exists in this change (grep-verified: no gateway/provider references in `src/`).
2. The internal detailed payment ledger (`DailyPayPayment`) is **removed** entirely — model, table, DTOs, schemas, repository methods, routes, and tests.
3. Payment state becomes **one manual monthly `Pending/Paid` marker per worker-month**, stored only as `paidAt` (when marked paid).
4. **No** payment amount records, partial payments, paid aggregates, paid-vs-accrued balances, negative-balance DTO state, or overpayment concept.
5. **Accrued amount remains useful**: sum of marked worked days × rate snapshots (informational, always recomputed, never stored).
6. Fiscal Payroll stays fully independent (it keeps its own `paidAt`; zero coupling introduced).

### Remaining product decisions that would block the proposal amendment

**None.** All blocking decisions are confirmed above. Three minor semantics have recommended defaults to pin during spec amendment (non-blocking):

| Semantics question | Recommended default | Rationale |
|---|---|---|
| Eligibility to mark a month PAID | Deny when the month has zero worked days (retain continuity with the old "no accrued work prevents closure" scenario) | Marker stays meaningful; no amounts involved |
| Reverting PAID → PENDING | Clears `paidAt`; audit details record the cleared value and transition | `paidAt` is a marker of current state, not history; AuditLog is the history |
| Day edits while PAID | Locked (the whole purpose of the control row); reverting to PENDING unlocks | Prevents accrual drift after "paid" without inventing amounts |

## Exploration: Amendment — Monthly Pending/Paid Marker

### Current State (verified 2026-09-03)

OpenSpec apply progress is **12/27 tasks** (Units 1–4 implemented and accepted; Unit 5 not started; no daily-pay routes or UI exist — glob-verified). Every feature file is **uncommitted/untracked** (`git status`: schema modified; migration dir, lib, types, schemas, repository, and all tests untracked) — pre-release work with zero deployed migrations.

Payment surface actually present in code:

| Location | Evidence |
|---|---|
| `prisma/schema.prisma` | `model DailyPayPayment` (lines 344–359: `amount Decimal(12,2)`, `paidOn @db.Date`); `Worker.dailyPayPayments` (line 70); `Organization.dailyPayPayments` (line 161); `enum DailyPayMonthStatus { OPEN, CLOSED }` (lines 378–381); `AuditAction` values `DAILY_PAY_MONTH_CLOSE`/`DAILY_PAY_MONTH_REOPEN` (lines 309–310) |
| `prisma/migrations/20260902180000_add_worker_daily_pay/migration.sql` | `CREATE TYPE "DailyPayMonthStatus" AS ENUM ('OPEN', 'CLOSED')`; `CREATE TABLE "DailyPayPayment"`; 3 payment indexes; 2 payment FKs; 2 `ALTER TYPE "AuditAction" ADD VALUE` |
| `src/lib/daily-pay.ts` | `moneyTotals(snapshots, payments)` → `{ accrued, paid, balance }` (lines 89–100); `sumMoney` retained (snapshot sums) |
| `src/types/daily-pay.ts` | `DailyPayPaymentDTO { id, amount, paidOn }`; `DailyPayTotalsDTO { accrued, paid, balance }`; `DailyPayMonthDTO.payments[]` |
| `src/schemas/daily-pay.schema.ts` | `dailyPayPaymentDtoSchema`; `dailyPayTotalsDtoSchema`; `payments` array in `dailyPayMonthSchema`; `recordPaymentSchema` (positivity-only, overpayment allowed); `RecordPaymentInput` |
| `src/repositories/daily-pay.repository.ts` | `createPayment`, `listPayments`, `aggregatePayments` (~lines 85–130); mutex upsert creates with `status: 'OPEN'` (line 145); `setMonthStatus` |
| `tests/unit/lib/daily-pay.test.ts` | `SPEC_MONTH_TOTALS` paid/balance fixture; moneyTotals paid/balance tests; negative-balance DTO validity; payment command describe block (~lines 287–328) |
| `tests/unit/repositories/daily-pay.repository.test.ts` | `pagos` describe (create/list/overpayment tests, lines 137–175); `aggregatePayments` test; append-only `updatePayment`/`deletePayment` surface test; `setMonthStatus('CLOSED')` tests |
| `tests/integration/daily-pay-concurrency.test.ts` | Payment model/`paidOn`/`amount` assertions; "exactly 3 `DECIMAL(12,2)`" count; payment index/FK assertions; payment round-trip (`createPayment`/`aggregatePayments`); `CLOSED` status tests |

Verified **not** affected: `src/schemas/audit.schema.ts` Zod `AuditActionSchema` has **no** daily-pay values yet (task 2.5a never started — nothing to remove there, only renamed values to add later); no `src/services/daily-pay.service.ts`; no `src/app/api/workers/[id]/daily-pay/` routes; no daily-pay components.

Retained and still valid from the original exploration: `Worker.dailyRate Decimal(12,2)` (nullable, positive-only); `DailyPayDay` per-civil-date worked records with rate snapshots (`@@unique([workerId, workDate])`); strict UTC civil dates and Monday–Sunday weeks; `Prisma.Decimal` money as canonical two-decimal strings (`toMoney`, `sumMoney`, `parseDailyRate`, `snapshotRate`, `parseCivilDate`, `weekRange`); tenant-required repository (constructor-throws, org predicate in every query, no role bypass, cross-tenant → not-found); `DailyPayMonthControl` unique `(organizationId, workerId, periodStart)` as serializable mutex row; audit-in-transaction pattern; fiscal Payroll independence guards.

### Affected Areas (amendment blast radius)

**Product artifacts** (amended by sdd-propose → sdd-spec → sdd-design → sdd-tasks; NOT by this phase):

| Artifact | Amendment needed |
|---|---|
| `proposal.md` | Remove "Record immutable partial/full payments" and "Close fully paid months"; replace with monthly Pending/Paid marker + `paidAt`; drop balance success criterion; keep tenancy/no-bypass, accrual, Payroll independence |
| `specs/worker-daily-pay-ledger/spec.md` | REMOVE requirement "Immutable Payment Ledger" (with Reason/Migration note); MODIFY "Exact Monetary Summaries" → accrued-only (drop paid/balance scenario); MODIFY tenancy scenario wording ("records a payment" → "marks a month paid") |
| `specs/worker-daily-pay-month-control/spec.md` | REWRITE: "Fully Paid Month Closure" (accrued == paid eligibility) → "Manual Pending/Paid Marker"; REMOVE "Reopened-Month Monetary Invariants" (overpaid-balance scenarios are meaningless without amounts); "Audited Reopening Preserves Payments" → audited revert preserving history; lock now tied to PAID; "Atomic Closure Lock" scenarios retained with new names |
| `design.md` | Architecture decisions: drop "Append-only payments and snapshotted days" row; DTO contract (`DailyPayMonthDTO`) loses `payments[]` and paid/balance totals, gains `status: 'PENDING'\|'PAID'`, `paidAt: string \| null`, `totals: { accrued: Money }`; drop `POST .../payments` route; rename close/reopen routes to mark-paid/revert; audit action names |
| `tasks.md` | All Phase 1–2 payment wording and 2.2–2.5c/3.x service, HTTP, UI tasks re-scoped (see Remediation Plan) |

**Code** (remediation units before implementation resumes):

| File | Change |
|---|---|
| `prisma/schema.prisma` | Delete `model DailyPayPayment` (16 lines) + 2 relation fields; `DailyPayMonthStatus` values `OPEN`/`CLOSED` → `PENDING`/`PAID`; add `paidAt DateTime?` to `DailyPayMonthControl`; rename the 2 `AuditAction` values |
| `prisma/migrations/20260902180000_add_worker_daily_pay/migration.sql` | Amend in place (see Migration Strategy) |
| `src/lib/daily-pay.ts` | Replace `moneyTotals(snapshots, payments)` with accrued-only helper (e.g. `accruedTotal(snapshots)` using `sumExact`); keep `sumMoney`, rate/date/week helpers untouched |
| `src/types/daily-pay.ts` | Delete `DailyPayPaymentDTO`; `DailyPayTotalsDTO` → `{ accrued: Money }`; `MonthStatus` → `'PENDING' \| 'PAID'`; `DailyPayMonthDTO`: −`payments[]`, +`paidAt: string \| null` (ISO-8601) |
| `src/schemas/daily-pay.schema.ts` | Delete `dailyPayPaymentDtoSchema`, `dailyPayTotalsDtoSchema`, `recordPaymentSchema`/`RecordPaymentInput`; month schema: status enum `PENDING/PAID`, +`paidAt` nullable datetime string, −`payments`, totals → accrued; `reopenMonthSchema` → revert command (optional reason); **keep `positiveMoneyInputSchema`** (still used by `setDailyRateSchema` for the daily rate) |
| `src/repositories/daily-pay.repository.ts` | Delete `createPayment`/`listPayments`/`aggregatePayments` + `DailyPayPayment` import; mutex upsert create default → `'PENDING'`; marker transitions stamp/clear `paidAt` (either generalize `setMonthStatus` with paidAt or add `markMonthPaid`/`revertMonthToPending` inside the serializable tx) |

**Tests** (all amended, never deleted wholesale — assertions migrate to the marker model):

| File | Change |
|---|---|
| `tests/integration/daily-pay-concurrency.test.ts` | Payment model/paidOn/amount assertions → removed; `DECIMAL(12,2)` count 3 → **2**; enum `OPEN/CLOSED` → `PENDING/PAID`; audit value strings renamed; payment table/index/FK assertions removed (3 tables → 2); payment round-trip → marker round-trip (mark PAID stamps `paidAt`, revert clears); additive/no-destructive/Payroll-intact guards unchanged |
| `tests/unit/lib/daily-pay.test.ts` | Remove paid/balance totals tests, negative-balance DTO validity, payment command block; add PENDING/PAID DTO, `paidAt` format, revert-command tests |
| `tests/unit/repositories/daily-pay.repository.test.ts` | Remove `pagos` block + `aggregatePayments` test; append-only surface test → "no payment methods exist at all" structural test; `setMonthStatus('CLOSED')` → marker transition tests incl. `paidAt` stamp/clear; mutex default `OPEN` → `PENDING` |

### Approaches

1. **Merge the marker into the month control row (recommended)** — `DailyPayMonthControl.status: PENDING | PAID` + `paidAt DateTime?`. Marking PAID is the single manual monthly marker; it locks day edits. Reverting to PENDING is audited and unlocks; `paidAt` cleared, value preserved in audit details.
   - Pros: one state machine, one row; exactly matches the confirmed "one manual monthly marker"; reuses the implemented unique `(organizationId, workerId, periodStart)` mutex, serializable transactions, and audit-in-tx machinery; smallest delta on already-accepted code; annual history falls out of persistent control rows (status + `paidAt` + recomputed accrued per worker-month — no new table).
   - Cons: cannot represent "locked but not paid" (a manual month-end lock without payment marking) — not a confirmed product need; accepted as out of scope.
   - Effort: Low–Medium.

2. **Independent lock + marker (two fields)** — keep `OPEN`/`CLOSED` for day-edit locking; add a separate `paidAt` marker on the control row.
   - Pros: supports a "reviewed/locked but unpaid" workflow; less renaming in already-written tests.
   - Cons: four state combinations to define, test, and render (`OPEN+Paid`, `CLOSED+Pending` are incoherent in the product story); contradicts the confirmed "one manual monthly Pending/Paid marker"; larger spec surface; more UI.
   - Effort: Medium.

3. **Separate marker table** — new `DailyPayMonthPaymentMarker` row per worker-month alongside the control row.
   - Pros: control row untouched.
   - Cons: extra table + join for a value that belongs on the month row; worst-case model count; no benefit over Approach 1.
   - Effort: Medium.

### Recommendation

**Approach 1** — merge the marker into `DailyPayMonthControl` and rename the status semantics to `PENDING`/`PAID`:

```prisma
model DailyPayMonthControl {
  id             String              @id @default(uuid())
  workerId       String
  worker         Worker              @relation(fields: [workerId], references: [id], onDelete: Cascade)
  periodStart    DateTime            @db.Date
  status         DailyPayMonthStatus @default(PENDING)
  paidAt         DateTime?           // stamped when marked PAID; cleared on revert
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  organizationId String
  organization   Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, workerId, periodStart])
  @@index([workerId])
  @@index([organizationId])
}

enum DailyPayMonthStatus {
  PENDING
  PAID
}
```

- **Lifecycle**: `PENDING` (days editable, accruing) → mark PAID (stamps `paidAt`, locks day edits, audited) → revert to PENDING (audited, optional reason, unlocks, clears `paidAt`, audit details keep the cleared value) → re-mark PAID (new `paidAt` = now). No monetary eligibility check and no amounts anywhere; optional zero-worked-days guard per the table above.
- **Superseded old semantics**: "close requires accrued == paid", "reclosure requires zero balance", "reopen preserves payments", overpaid/negative-balance scenarios — all removed with the payment ledger. `accrued` remains a computed, informational summary.
- **Audit**: rename Prisma enum values `DAILY_PAY_MONTH_CLOSE`/`DAILY_PAY_MONTH_REOPEN` → `DAILY_PAY_MONTH_MARKED_PAID`/`DAILY_PAY_MONTH_MARKED_PENDING` (unreleased enum + zero audit rows with old values → free rename); task 2.5a will add the same values to the Zod `AuditActionSchema` (currently untouched — verified). Audit details record actor, organization, worker, period, transition, and on revert the cleared `paidAt`.
- **DTO**: `DailyPayMonthDTO { workerId, periodStart, dailyRate: Money|null, status: 'PENDING'|'PAID', paidAt: string|null, days[], totals: { accrued: Money } }`.
- **Annual history**: control rows persist per worker-month forever; a year view lists rows with status + `paidAt` + recomputed accrued. No new structure.

### Migration Strategy

**Amend the pending migration in place — do NOT add a destructive follow-up migration.** Evidence this is safe:

- All daily-pay files are untracked/uncommitted (`git status`, 2026-09-03); the migration has only ever been applied to disposable verify containers (`edi-daily-pay-verify`, `edi-daily-pay-verify-u4`), both removed (apply-progress records cleanup verification).
- The only accidental operation against the repo-configured remote datasource was a read-only `db push` comparison reporting "already in sync" (apply-progress, Unit-4 harness deviation note) — no DDL reached any real database.
- Zero `AuditLog` rows with `DAILY_PAY_MONTH_*` actions exist anywhere (feature unreleased), so the enum rename is free.

Amendment content: remove `CREATE TABLE "DailyPayPayment"` + its 3 indexes + 2 FKs; `CREATE TYPE "DailyPayMonthStatus" AS ENUM ('PENDING', 'PAID')`; rename the two `ALTER TYPE "AuditAction" ADD VALUE` lines; add `"paidAt" TIMESTAMP(3)` to the `DailyPayMonthControl` create table. The migration stays purely additive for the real baseline (the integration test's no-destructive-ops guard remains valid). Residual pre-amend check (one line): confirm the remote DB has no `DailyPayPayment` table.

### Remediation Plan (Strict TDD, ≤400-line slices, native attempt accounting)

Delivery returns to the **400-line default** — Unit 4's `size:exception` does **not** carry over to remediation. Keep `feature-branch-chain` / `ask-on-risk`. Three remediation units run full RED→GREEN→REFACTOR with real behavioral assertions and the established native attempt accounting, **before Unit 5 starts**:

| Unit | Scope | Indicative size |
|---|---|---|
| R1 | Schema + migration amendment + integration contract test (RED: updated contract fails against current schema; GREEN: schema/migration amended; `prisma validate` + disposable-PostgreSQL `migrate deploy` harness) | ~90–150 |
| R2 | `moneyTotals` → accrued helper; DTO types; Zod schemas; `tests/unit/lib` rewrite of payment/totals blocks into marker DTO/command tests | ~120–180 |
| R3 | Repository: remove payment methods, marker transitions with `paidAt`; repo unit tests (no-payment-surface + marker transitions); DB round-trip tests → marker round-trip | ~180–230 |

Then Units 5–8 are re-scoped in `tasks.md` by the tasks phase: service (no payment logic; guard + lock + audited transitions), control/audit (renamed actions), HTTP (payments route deleted; mark-paid/revert endpoints), UI (payment form → Pending/Paid toggle). Payment removal also shrinks these forecasts.

**Completed task checkboxes that must be reopened/replaced** (currently `[x]` in `tasks.md`; this phase does NOT edit tasks.md): **all 12** — `1.1`, `1.1a`, `1.2`, `1.3`, `1.3a`, `1.3b`, `1.4`, `1.4a`, `1.4b` (Units 1–3: every touched unit contains payment/total/paid artifacts), and `2.1`, `2.3`, `2.5b` (Unit 4: payment methods, payment tests, payment refactor). Remaining unchecked tasks `2.2`–`2.5c`, `3.1`–`3.4`, `4.1`–`4.3` need **rewording** (payments/overpayment/balance/CLOSED vocabulary → marker vocabulary; delete the `payments/route.ts` deliverable from 3.2; requirement references L1–L6/M1–M6 renumber after spec amendment). Apply-progress history stays untouched.

### Risks

- **Accidental coupling to Fiscal Payroll (top risk)**: Payroll already has `paidAt` + `markAsPaid`. Nothing may link the daily-pay month marker to Payroll rows, formulas, or its `paidAt` — two unrelated "paid" concepts. Mitigations: spec retains the Payroll-independence requirement and its scenario; the integration test already guards "no daily-pay fields in Payroll" / "no `ALTER TABLE Payroll`"; UI naming must not imply the fiscal payroll was marked.
- **Reopening (reverting) a paid month**: reverting clears `paidAt` and unlocks day edits; accrual may change afterwards. No monetary inconsistency is possible (nothing stored), but stale `paidAt` must not survive in cached DTOs, and audit details are the only record of previous payment marks — acceptable within the confirmed scope, but it makes the audit-details schema load-bearing.
- **Enum/status rename drift**: `OPEN`/`CLOSED`/close/reopen/payment vocabulary persists across tasks, specs, design, tests, and the repository's explicit `status: 'OPEN'` upsert default. A stale-reference sweep (`DailyPayPayment|recordPayment|aggregatePayments|payments:|balance|CLOSED|REOPEN` within change-scoped paths) must gate the remediation GREEN phases.
- **`positiveMoneyInputSchema` collateral**: it is shared by `setDailyRateSchema` (rate positivity is retained product behavior) — deleting it as "payment schema" would break rate validation. Keep it.
- **DECIMAL count guard**: the integration test asserts "exactly 3 `DECIMAL(12,2)`" — must become 2 (`Worker.dailyRate`, `rateSnapshot`) or the RED phase will fail for the wrong reason.
- **Budget discipline**: remediation units are forecast ≤400 each; the 12 reopened boxes make progress temporarily 0/27-equivalent — acceptable and honest; re-forecast in tasks phase.
- **Pre-existing out-of-scope hazards unchanged**: payroll PDF tenant hole and Payroll formula duplication remain separate follow-ups; do not fold them into this amendment.

### External Research

**Unnecessary** before the proposal amendment. This is a pure product-scope reduction with all decisions user-confirmed; no external library, protocol, provider, or API surface is involved. `sdd-research` would add no auditable value here.

### Ready for Proposal

**Yes.** The orchestrator can tell the user: exploration amendment complete and evidence-based; all payment-amount machinery is removed in favor of one manual monthly `Pending/Paid` marker with `paidAt` on the existing month-control row; accrued summaries are retained; migration is amended in place (safe — pre-release, undeployed); remediation is 3 Strict-TDD slices ≤400 lines with all 12 completed checkboxes reopened; no blocking product decisions remain. Next step: **sdd-propose** to amend proposal + delta specs, then sdd-design → sdd-tasks before apply resumes.
