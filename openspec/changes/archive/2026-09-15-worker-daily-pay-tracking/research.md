---
schema: gentle-ai.sdd-research/v1
revision: 1
change: worker-daily-pay-tracking
store: openspec
outcome: done
generated_at: 2026-09-03
admission:
  runtime_capability_schema: gentle-ai.sdd-research-capability/v1
  declared_grants: [documentation, open-web]
  observed_grants: [documentation]
  denied_grants: [open-web]
  denial_reason: >-
    The open-web grant is declared in the runtime capability declaration, but no
    open-web retrieval capability was observed in this session's toolset. Fail-closed:
    the grant is denied and zero claims in this artifact derive from open-web sources.
    All four research questions are fully supported within the documentation class.
  source_classes_used: [documentation]
questions:
  - q1-paidat-state-invariant-postgres-prisma
  - q2-transition-audit-pattern
  - q3-idempotency-concurrency-mark-revert
  - q4-separation-from-payroll-and-payment-providers
product_decisions_status: confirmed
---

# Research Evidence — Manual Monthly PENDING|PAID Marker (`worker-daily-pay-tracking`)

This artifact is the auditable evidence record for the selected research lane. Every claim below maps to a listed source; product choices are kept in a separate, explicitly non-authoritative section. Answers first, evidence after.

## Answers at a glance

| # | Question | Evidence-backed answer |
|---|----------|------------------------|
| 1 | What guarantees `PAID ⇒ paidAt`, `PENDING ⇒ no paidAt`? | A **row-local PostgreSQL CHECK constraint** on `DailyPayMonthControl`, added via **hand-authored migration SQL** (Prisma Migrate cannot declare CHECK constraints). Application validation (Zod) alone cannot guard non-API writers. |
| 2 | Transition/audit pattern without a payment ledger? | Current-state columns on the control row (`status`, `paidAt`) + **append-only `AuditLog` rows recording actor, datetime, previous value, new value**, written **in the same transaction** as the state change (OWASP event-shape guidance + Prisma `$transaction` all-or-nothing semantics). |
| 3 | Idempotency/concurrency for mark/revert? | **Serializable interactive transactions** (Prisma `isolationLevel: Serializable` on PostgreSQL) with automatic **retry on SQLSTATE 40001 / Prisma P2034**; the unique `(organizationId, workerId, periodStart)` control row is the serialization anchor. A duplicate/racing mark on an already-`PAID` month surfaces as **HTTP 409 Conflict** (RFC 9110 semantics, per MDN) or an idempotent no-op — spec phase pins which. |
| 4 | Why keep this separate from Fiscal Payroll `paidAt` and payment providers? | PostgreSQL enforces **no cross-table coupling unless a FK/trigger exists** — with no FK between `DailyPayMonthControl` and `Payroll`, the two `paidAt` fields are independent *by construction*; any coupling would have to be deliberately built. Provider separation is a confirmed product decision (non-authoritative). |

---

## 1. Admission

| Item | Value |
|------|-------|
| Runtime capability schema | `gentle-ai.sdd-research-capability/v1` |
| Declared grants | `documentation`, `open-web` |
| **Observed grants** | `documentation` (Context7 MCP returned current, versioned library documentation) |
| **Denied grants** | `open-web` — declared but not observed in this session's toolset; fail-closed |
| Source classes used | `documentation` only |
| Effect on outcome | None: all four questions are fully supported by documentation-class sources. No claim depends on the denied grant. |

---

## 2. Sources

| ID | Class | Title | Publisher | URL | Accessed |
|----|-------|-------|-----------|-----|----------|
| `PG-DDL` | documentation | Constraints — CHECK Constraints | PostgreSQL (postgresql.org, current docs) | https://www.postgresql.org/docs/current/ddl-constraints.html | 2026-09-03 |
| `PG-CREATETABLE` | documentation | `CREATE TABLE` — CHECK clause | PostgreSQL (postgresql.org, current docs) | https://www.postgresql.org/docs/current/sql-createtable.html | 2026-09-03 |
| `PG-TXISO` | documentation | Concurrency Control — 13.2.3 Serializable Isolation Level | PostgreSQL (postgresql.org, current docs) | https://www.postgresql.org/docs/current/transaction-iso.html | 2026-09-03 |
| `PG-SFH` | documentation | Concurrency Control — 13.5 Serialization Failure Handling | PostgreSQL (postgresql.org, current docs) | https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html | 2026-09-03 |
| `PG-APPCONS` | documentation | App-Level Consistency — Enforcing Consistency with Serializable Transactions | PostgreSQL (postgresql.org, current docs) | https://www.postgresql.org/docs/current/applevel-consistency.html | 2026-09-03 |
| `PRISMA-UNSUPPORTED` | documentation | Unsupported features in Prisma Migrate | Prisma (official docs) | https://www.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features | 2026-09-03 |
| `PRISMA-DBFEATURES` | documentation | Database features — Constraints | Prisma (official docs) | https://www.prisma.io/docs/orm/v7/reference/database-features | 2026-09-03 |
| `PRISMA-TX` | documentation | Transactions (`$transaction`) | Prisma (official docs) | https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions | 2026-09-03 |
| `PRISMA-ERR` | documentation | Error reference — P2034 | Prisma (official docs) | https://www.prisma.io/docs/orm/v6/reference/error-reference | 2026-09-03 |
| `OWASP-LOGVOCAB` | documentation | Logging Vocabulary Cheat Sheet | OWASP Cheat Sheet Series | https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html | 2026-09-03 |
| `OWASP-REST` | documentation | REST Security Cheat Sheet — Audit logs | OWASP Cheat Sheet Series | https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html | 2026-09-03 |
| `MDN-409` | documentation | HTTP 409 Conflict | MDN Web Docs (Mozilla) | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/409 | 2026-09-03 |
| `MDN-IDEM` | documentation | Idempotency-Key header | MDN Web Docs (Mozilla) | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Idempotency-Key | 2026-09-03 |
| `MDN-STATUS` | documentation | HTTP response status codes | MDN Web Docs (Mozilla) | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status | 2026-09-03 |

Retrieval note: documentation was retrieved via the Context7 MCP mirror of the official docs repositories (prisma/web, owasp/cheatsheetseries, mdn/content, PostgreSQL website docs). URLs above are the canonical public locations of the retrieved pages.

### Bounded excerpts

- `PG-DDL`: "PostgreSQL does not support CHECK constraints that reference table data outside the new or updated row being evaluated. … For cross-row and cross-table restrictions, UNIQUE, EXCLUDE, or FOREIGN KEY constraints should be used, or custom triggers…" Also: check constraints "evaluate to satisfied if the expression returns true or null".
- `PG-CREATETABLE`: "The CHECK clause defines a Boolean expression that rows must satisfy during insert or update operations. CHECK expressions cannot contain subqueries or reference variables other than columns of the current row…"
- `PG-TXISO`: "PostgreSQL implements Serializable isolation using Serializable Snapshot Isolation (SSI), which augments Snapshot Isolation with anomaly detection. While it guarantees equivalent serial outcomes upon commit, concurrent conflicts can occasionally raise errors…"
- `PG-SFH`: "Repeatable Read and Serializable isolation levels can produce errors designed to prevent serialization anomalies, requiring applications to be prepared to retry failed transactions. These errors consistently return the SQLSTATE code 40001 (serialization_failure). It may also be advisable to retry deadlock failures (SQLSTATE 40P01), as well as certain unique-key violations (SQLSTATE 23505)…"
- `PG-APPCONS`: "If the Serializable isolation level is applied to all writes and consistency-critical reads, no additional effort is needed to ensure consistency. Applications should utilize a framework that automatically retries transactions aborted due to serialization failures…"
- `PRISMA-UNSUPPORTED`: feature table row — `CHECK` supported in database ✔️, in Prisma Migrate "Not yet"; plus "some database features cannot be represented in the Prisma schema"; workaround shown: append custom SQL (e.g., trigger/function DDL) to the generated migration.
- `PRISMA-DBFEATURES`: "CHECK and EXCLUDE constraints are supported in Prisma Client, but are not yet natively configurable in Prisma schema or Prisma Migrate."
- `PRISMA-TX`: "Operations are executed sequentially in the order they are passed in the array. If any operation fails, the entire transaction is rolled back." Interactive transactions accept `{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait, timeout }`; "Transactions should be kept short to avoid deadlocks and performance degradation"; documented retry loop catching `error.code === "P2034"`.
- `PRISMA-ERR`: `P2034` — "Transaction failed due to a write conflict or a deadlock. Please retry your transaction".
- `OWASP-LOGVOCAB`: state-change events include `datetime`, actor user id, object path, **previous** and **new** values (e.g., `permissions_changed:joebob1, /users/admin/some/important/path,0511,0777`; `authz_change:joebob1,user,admin`).
- `OWASP-REST`: "Audit logs should be written before and after security-related events… sanitize log data to prevent log injection attacks."
- `MDN-409`: example — `"Task locked. Cannot start a new automation since job is already running."` (409 response for a resource already in the requested state); status codes "listed below are defined by RFC 9110" (`MDN-STATUS`).
- `MDN-IDEM`: "If a client resends a request with an `Idempotency-Key` too quickly, the server might return a `409 Conflict` error response." (Header itself is an IETF draft — see Uncertainty.)

---

## 3. Claims by question

### Q1 — Invariant guaranteeing `PAID ⇒ paidAt`, `PENDING ⇒ no paidAt` (PostgreSQL/Prisma)

| Claim | Source IDs | Notes |
|-------|-----------|-------|
| C1.1 PostgreSQL CHECK constraints define a Boolean expression that **every row must satisfy during insert or update**; the expression may reference only the current row's columns and may not contain subqueries. | `PG-CREATETABLE`, `PG-DDL` | Directly quotes docs. The desired invariant is exactly row-local, so it is fully expressible as a CHECK. |
| C1.2 CHECK expressions evaluate to satisfied on `true` **or `null`**; with `status NOT NULL DEFAULT 'PENDING'`, the pair invariant is total (no null-status hole). | `PG-DDL` | Low inference from the quoted semantics. |
| C1.3 Cross-row/cross-table restrictions are explicitly out of scope for CHECK; PostgreSQL names UNIQUE/EXCLUDE/FK or triggers as the cross-table mechanisms. | `PG-DDL` | Confirms a single-row CHECK is the *correct* mechanism for the `status`/`paidAt` pair; also feeds Q4. |
| C1.4 Prisma supports CHECK constraints **in the database and in Prisma Client, but not in Prisma schema or Prisma Migrate** ("Not yet"); the documented workaround is **hand-authored/append-custom SQL in the migration**. | `PRISMA-UNSUPPORTED`, `PRISMA-DBFEATURES` | This is why the hand-authored migration is not a hack but Prisma's documented path for CHECK constraints. |
| C1.5 (inference, flagged) Application-only validation (e.g., Zod at the API boundary) guards only writers that pass through it; a database CHECK guards **every** writer (scripts, seeds, direct SQL, future services) because PostgreSQL evaluates it on every insert/update. | derived from `PG-CREATETABLE`, `PG-DDL` | Inference level: low (directly follows from C1.1). Product-relevant consequence: both layers are complementary — Zod for input UX, CHECK for the invariant. |

Evidence-backed mechanism (for design, to be proven by the R1 integration test):

```sql
ALTER TABLE "DailyPayMonthControl"
  ADD CONSTRAINT daily_pay_month_status_paid_at_consistency
  CHECK (
    ("status" = 'PAID' AND "paidAt" IS NOT NULL)
    OR
    ("status" = 'PENDING' AND "paidAt" IS NULL)
  );
```

Verdict: **database CHECK constraint in a hand-authored migration is the guaranteeing mechanism**; application-only validation is necessary but not sufficient.

### Q2 — Transition/audit pattern for mark-paid and revert (no financial ledger)

| Claim | Source IDs | Notes |
|-------|-----------|-------|
| C2.1 State-change audit events should record **datetime, actor identity, subject/object, previous value, and new value** — OWASP's vocabulary models exactly this shape for permission/authz/sensitive-data changes. | `OWASP-LOGVOCAB` | Direct mapping: mark-paid = previous `PENDING` → new `PAID` (+ `paidAt` stamped); revert = previous `PAID`/`paidAt=t` → `PENDING`/`paidAt=null`, with the cleared `t` in the audit details. |
| C2.2 Audit logs belong around security-relevant state changes and must be sanitized against log injection. | `OWASP-REST` | Supports keeping `revertedReason` free-text out of the audit identity fields / sanitized before logging. |
| C2.3 Prisma `$transaction` (array or interactive) executes its operations as a single database transaction; **"If any operation fails, the entire transaction is rolled back"** — i.e., the state transition and its `AuditLog` row are all-or-nothing. | `PRISMA-TX` | This is the mechanism behind the codebase's already-accepted audit-in-transaction pattern. |
| C2.4 (design application, flagged) Current-state columns on the control row + append-only `AuditLog` rows give who/when/previous-state evidence **without** a financial ledger: the row is current truth, the log is history. | application of C2.1 + C2.3 | Matches the confirmed product scope (no amounts, no ledger). On revert, the audit details are load-bearing because the row loses the cleared `paidAt`. |

Verdict: **current-state row + atomic (same-transaction) append-only audit rows with previous→new values** is the evidence-backed pattern.

### Q3 — Idempotency/concurrency of mark/revert; control row + serializable transaction

| Claim | Source IDs | Notes |
|-------|-----------|-------|
| C3.1 PostgreSQL Serializable isolation (SSI) gives **serial-equivalent outcomes on commit**; applying it to *all writes and consistency-critical reads* enforces check-then-act consistency with **no additional locking effort**. | `PG-TXISO`, `PG-APPCONS` | Validates the codebase's control-row + serializable approach as sufficient by itself for the marker state machine. |
| C3.2 Serialization failures consistently return **SQLSTATE 40001** and applications must retry; some concurrent **unique-key violations (23505)** may also merit retry. | `PG-SFH` | Retry must be scoped — see nuance N1 below. |
| C3.3 Prisma interactive transactions accept **`isolationLevel: Serializable`** on PostgreSQL; `P2034` ("write conflict or a deadlock") is documented as **retryable**, with documented retry-loop and exponential-backoff-extension patterns; transactions should be kept short and bounded (`maxWait`, `timeout`). | `PRISMA-TX`, `PRISMA-ERR` | The existing repository's serializable transaction should wrap mark/revert; retry on P2034 only. |
| C3.4 The unique `(organizationId, workerId, periodStart)` control row means one row per worker-month exists per state transition; serializable check-then-write on that row makes concurrent mark/revert attempts serializable (one wins; losers get 40001/P2034 → retry → see the committed state). | `PG-TXISO`, `PG-APPCONS` (mechanism); unique-row-as-mutex is codebase-anchored context (non-authoritative) | The DB provides the serialization; the control row provides the single serialization anchor. |
| C3.5 A request that conflicts with the **current state** of the resource is served by **HTTP 409 Conflict** (RFC 9110-defined code); MDN's examples include exactly the racing cases: "Task locked… job is already running" and a duplicate in-flight `Idempotency-Key` request. | `MDN-409`, `MDN-STATUS`, `MDN-IDEM` | Maps to: mark on an already-`PAID` month → 409; revert on an already-`PENDING` month → 409 (or idempotent 200 — spec phase pins; recommendation in P3 below). |

Nuances (not contradictions):

- **N1 — retry scoping**: `PG-SFH` advises retrying *certain* unique-key violations under concurrency, but a state conflict ("already PAID") is a **business outcome** (409/idempotent no-op), not a transport error. Retry loops should cover SQLSTATE 40001 / Prisma P2034 (and 40P01 deadlocks), and let the serializable re-read surface committed state for the conflict decision.
- **N2 — Idempotency-Key header**: recognized on MDN but defined by a non-final IETF draft. Not required here: the state machine itself makes mark/revert naturally idempotent-at-the-state-level once conflicts are decided. Recorded for completeness.

Verdict: **serializable interactive transactions + P2034/40001-bounded retry, anchored on the unique control row; state conflicts answered with 409 (or pinned idempotent no-op)**.

### Q4 — Separation from Fiscal Payroll `paidAt` and payment-provider semantics

| Claim | Source IDs | Notes |
|-------|-----------|-------|
| C4.1 PostgreSQL enforces **no cross-table restriction or coupling** unless a UNIQUE/EXCLUDE/FK constraint or trigger exists (`PG-DDL` names these as *the* cross-table mechanisms). With no FK between `DailyPayMonthControl` and `Payroll`, the two `paidAt` columns are **independent by construction**; any coupling would have to be deliberately built. | `PG-DDL` | Technical evidence that "keep them separate" is the schema's default state, and that accidental DB-level coupling cannot occur. |
| C4.2 Fiscal Payroll independence and "no payment provider" are **confirmed product decisions** (non-authoritative for research); no documentation source obliges or implies provider integration, and nothing in the DB mechanisms pulls the two domains together. | product decisions (see §5) + `PG-DDL` | Honest scoping: the *external-evidence* portion of this question is the independence argument in C4.1; the *product* portion is decision territory and is kept separate as required. |

Verdict: **separation is both the confirmed product decision and the enforced-by-construction database default**; the spec's existing Payroll-independence guard (integration test asserting no daily-pay fields in `Payroll`) remains the regression net.

---

## 4. Contradictions, uncertainty, freshness

**Contradictions found:** none between sources.

**Uncertainty:**

- U1 — Prisma doc excerpts were retrieved from the v6/v7 documentation paths while the codebase uses **Prisma 5.22**. The "CHECK not configurable in Prisma schema/Migrate" status is longstanding (it predates 5.22 a fortiori), but the R1 integration contract test must prove the actual behavior (`prisma validate` + disposable-PostgreSQL `migrate deploy`), which also absorbs any future Prisma drift.
- U2 — PostgreSQL enum-vs-literal comparison inside the CHECK (`"status" = 'PAID'`) relies on standard literal coercion to the enum type; not separately sourced here — it will be exercised by the R1 RED test rather than assumed.
- U3 — The `Idempotency-Key` header is draft-status (N2); not load-bearing for this change.
- U4 — Whether a duplicate mark returns 409 vs an idempotent 200 no-op is a **product/spec pin**, not a research finding (recommendation P3).

**Freshness:** PostgreSQL "current" docs accessed 2026-09-03 (described behavior is long-standing); OWASP cheat sheets from the live master branch (stable content); MDN mirrors RFC 9110 for status codes.

## 5. Product decisions (non-authoritative, confirmed — restated for scope only)

1. One manual marker per worker + calendar month. 2. States `PENDING|PAID`; `PAID` stamps `paidAt`; revert clears it. 3. Marking paid locks worked-day edits; revert unlocks and is audited. 4. Accrued amount stays computed from worked-day rate snapshots. 5. No money transfer, no provider, no internal payment-amount records, no partials/aggregate/balance/overpayment concepts. 6. Fiscal Payroll remains fully independent.

These are **not** claims derived from sources; they bound how the evidence above is applied.

## 6. Recommendations for the proposal amendment (non-authoritative, evidence-informed)

- **P1** — Amend the pending migration in place to include the row-local CHECK from Q1 (additive; pre-release, undeployed — consistent with the exploration's migration strategy). Zod keeps validating API input; the CHECK owns the invariant.
- **P2** — Audit details for mark/revert follow OWASP's shape: actor, organization, worker, period, transition (previous→new), and on revert the cleared `paidAt` value; state change + audit row inside the same Prisma transaction (already the codebase pattern).
- **P3** — Recommend `409 Conflict` for a mark/revert that contradicts committed state (matches MDN's RFC 9110-based examples and the codebase's existing 409 convention), with retry-on-P2034/40001 only. Spec phase must pin this explicitly.
- **P4** — Keep zero FK/coupling between `DailyPayMonthControl` and `Payroll`; retain the Payroll-independence integration guards.

## 7. Research readiness

| Condition | Value |
|-----------|-------|
| Outcome | `done` |
| Questions source-supported | 4 / 4 |
| Every claim mapped to source IDs | Yes |
| Product decisions | `confirmed` (separate, non-authoritative) |
| Contradictions / uncertainty / freshness recorded | Yes (§4) |
| Admission | documentation granted and used; open-web denied fail-closed with zero dependent claims |

**Ready for proposal amendment: yes** (conditions verified in `state.yaml` per the lifecycle contract).
