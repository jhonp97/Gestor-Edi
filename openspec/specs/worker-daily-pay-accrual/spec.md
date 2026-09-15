# Worker Daily Pay Accrual Specification

## Purpose

Define tenant-scoped worked-day accrual, exact summaries, and Payroll independence without payment accounting.

## Requirements

### Requirement: Positive Daily Rate and Immutable Snapshots

A worker's daily rate MAY be absent; when configured, it MUST be positive. Marking a worked day MUST snapshot the current rate, and later rate changes MUST NOT alter historical snapshots.

#### Scenario: Rate is snapshotted

- GIVEN a worker's rate is 100 and a date is unmarked
- WHEN an authenticated tenant member marks it and later changes the rate to 120
- THEN that date MUST accrue 100 and a later marked date MUST snapshot 120

#### Scenario: Missing or invalid rate

- GIVEN a worker has no rate, or a proposed rate is not positive
- WHEN a member marks a day or saves that proposed rate
- THEN the operation MUST be denied without changing worked days or snapshots

### Requirement: Explicit Worked Days and Civil Dates

Attendance MUST be created only by explicit mark and removed only by explicit unmark. Dates MUST be valid `YYYY-MM-DD` civil dates and MUST NOT shift by timezone or be inferred.

#### Scenario: Mark and unmark

- GIVEN a valid unmarked civil date and a positive configured rate
- WHEN a member marks and then unmarks that date
- THEN one snapshot MUST be created and then removed from accrual

#### Scenario: Invalid or inferred date

- GIVEN an invalid calendar date or an unmarked historical date
- WHEN accrual is requested
- THEN the invalid date MUST be rejected and the historical date MUST NOT accrue

### Requirement: Monday–Sunday Exact Accrual

Weeks MUST be presented Monday through Sunday. Totals MUST equal the exact sum of included rate snapshots and MUST expose accrued value only.

#### Scenario: Week boundary

- GIVEN worked days on Sunday and the following Monday
- WHEN weekly accrual is presented
- THEN Sunday MUST appear in the ending week and Monday in the next week

#### Scenario: Exact total

- GIVEN snapshots of 100.25, 100.25, and 100.25
- WHEN the period is summarized
- THEN accrued MUST equal 300.75 without recalculating from the current rate

### Requirement: Tenant-Scoped Access

Only authenticated members of the worker's organization MUST read or write accrual data. Cross-organization access MUST be denied, and `PLATFORM_ADMIN` MUST have no bypass.

#### Scenario: Tenant member writes

- GIVEN an authenticated member and worker belong to the same organization
- WHEN the member sets a valid rate or marks or unmarks a day
- THEN the valid write MUST succeed only within that organization

#### Scenario: Authentication and tenant denial

- GIVEN an unauthenticated actor or an actor outside the worker's organization, including `PLATFORM_ADMIN`
- WHEN the actor attempts an accrual read or write
- THEN access MUST be denied without exposing or changing data

### Requirement: No Payment or Payroll Coupling

The capability MUST NOT accept, store, derive, or expose payment records, amounts paid, full or partial payments, paid aggregates, balances, overpayment, or provider data. It MUST remain independent of Fiscal Payroll.

#### Scenario: Accrual response has no payment accounting

- GIVEN worked-day snapshots exist
- WHEN their summary is requested
- THEN it MUST contain accrued total only and no payment-accounting data

#### Scenario: Contexts remain independent

- GIVEN daily-pay and Fiscal Payroll records exist for a worker
- WHEN either context's rate, worked days, or `paidAt` changes
- THEN the other context's records and behavior MUST remain unchanged
