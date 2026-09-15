# Worker Daily Pay Month Control Specification

## Purpose

Define monthly marker truth, locking, audit, tenancy, and independence.

## Requirements

### Requirement: Unique Marker and State Invariant

The system MUST enforce one control per organization, worker, and calendar month. It MUST be `PENDING` iff `paidAt` is null and `PAID` iff present.

#### Scenario: Concurrent control creation

- GIVEN no control exists for one tenant-worker-month
- WHEN concurrent requests create that control
- THEN exactly one MUST exist as `PENDING` with null `paidAt`

#### Scenario: Invalid state pair

- GIVEN `PAID` has null `paidAt` or `PENDING` has present `paidAt`
- WHEN the write is attempted
- THEN it MUST be rejected without creating or changing a control

### Requirement: Manual and Idempotent Paid Mark

Marking `PAID` MUST be manual, require a worked day, stamp `paidAt`, append one audit, and lock day edits. Accrued value MUST NOT trigger or qualify it.

#### Scenario: Eligible month is marked paid

- GIVEN a `PENDING` month has a worked day
- WHEN an authenticated tenant member manually marks it `PAID`
- THEN `paidAt` MUST be stamped, one audit appended, and day edits locked

#### Scenario: Empty month is denied

- GIVEN a `PENDING` month has no worked days
- WHEN a member attempts to mark it `PAID`
- THEN it MUST fail without state, timestamp, or audit change

#### Scenario: Accrual never marks automatically

- GIVEN a `PENDING` month has any positive accrued total
- WHEN accrual changes without a manual command
- THEN status MUST remain `PENDING` and `paidAt` MUST remain null

#### Scenario: Repeated or concurrent mark

- GIVEN a `PAID` month has timestamp T and one mark audit event
- WHEN one or more mark-paid requests repeat
- THEN it MUST succeed unchanged at T without another audit event

### Requirement: Audited Revert to Pending

A revert MUST clear `paidAt`, unlock days, and append an append-only audit containing tenant, worker, month, actor, time, `PAID→PENDING`, previous `paidAt`, and optional reason. Reverting `PENDING` MUST be an unaudited no-op.

#### Scenario: Paid month is reverted

- GIVEN a `PAID` month has timestamp T
- WHEN a tenant member reverts it with an optional reason
- THEN it MUST become `PENDING`, clear T, unlock edits, and append that audit

#### Scenario: Pending month is reverted again

- GIVEN a `PENDING` month has null `paidAt`
- WHEN revert is requested
- THEN it MUST succeed unchanged without an audit event

### Requirement: Atomic Serializable Transitions

Each transition and audit MUST commit atomically under Serializable isolation with bounded retry. Failed attempts MUST produce neither state change nor audit.

#### Scenario: Transition attempt fails

- GIVEN retries exhaust or an audit write fails
- WHEN transition processing ends
- THEN state and audit MUST both remain unchanged

#### Scenario: Mark races with a day edit

- GIVEN mark-paid and worked-day edit requests race for one `PENDING` month
- WHEN bounded Serializable processing completes
- THEN no edit MAY commit after the `PAID` transition

### Requirement: Tenant-Scoped Transitions

Only authenticated members of the worker's organization MUST initiate transitions. Cross-organization access MUST be denied, and `PLATFORM_ADMIN` MUST have no bypass.

#### Scenario: Cross-tenant transition

- GIVEN an unauthenticated actor or outsider, including `PLATFORM_ADMIN`
- WHEN the actor attempts mark-paid or revert
- THEN access MUST be denied without state or audit changes

### Requirement: Informational History and Payroll Independence

Accrued MUST be informational, never an eligibility comparison. Annual history MUST expose status, `paidAt`, and accrued only, without payment-accounting data. Fiscal Payroll MUST remain independent.

#### Scenario: Annual history

- GIVEN controls and worked-day snapshots span a year
- WHEN annual history is requested
- THEN each month MUST expose status, `paidAt`, and exact accrued only

#### Scenario: Paid contexts remain independent

- GIVEN daily-pay month control and Fiscal Payroll exist for the same worker
- WHEN either context's mark-paid or `paidAt` changes
- THEN the other context MUST remain unchanged
