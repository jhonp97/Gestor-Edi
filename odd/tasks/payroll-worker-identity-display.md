# Payroll worker identity display

## Goal and authorization
The user reports a long encoded value beneath the worker name on `/nomina` and in the DNI/NIE field of the generated PDF, and authorizes fixing both. The parent inspected the supplied screenshot without copying its personal data. The user reports their manual application checks otherwise worked; this does not close the separate migration or staging readiness gates.

## Scope and constraints
- Trace payroll worker identity mapping and reuse established server-side decryption.
- Preserve database encryption, existing records, authentication and tenant scoping.
- Never expose ciphertext as a fallback or log personal identity data.
- No database access, migrations, production changes, installs, commits, push or merge.
- Preserve all unrelated dirty files, including pnpm configuration, daily-pay work and R4 rehearsal artifacts.

## Tasks
- [x] P1 — Map list/detail/PDF identity flow and existing decryption/test conventions. First scout failed; replacement read-only scout and parent source readback confirmed raw encrypted worker.dni in list/detail/PDF. Existing worker-utils returns ciphertext on failure; do not reuse its unsafe fallback.
- [x] P2 — Added immutable server-only `src/lib/payroll-worker-identity.ts` mapper using EncryptionService, applied in payroll list/detail and PDF route. Missing/failed decryption yields empty identity, never ciphertext. PDF now checks session organization before lookup and scopes both repositories. Added three synthetic regression test files; writer observed RED before implementation then GREEN **21/21**; no storage changes.
- [x] P3 — Independent verifier returned **CLEAR** for bounded source/test scope: **21/21** focused tests, full nonincremental TypeScript, scoped ESLint and scoped diff whitespace check all passed. No live browser, real PDF rendering, DB or Next runtime verified. Manual retest: refresh list/detail and download a NEW PDF; check DNI/NIE and unchanged totals.

## Acceptance
- Payroll UI and PDF receive the intended worker DNI/NIE rather than stored ciphertext.
- Missing or invalid identity data follows a safe existing convention without displaying ciphertext.
- Existing tenant isolation and encrypted persistence remain unchanged.
- Tests use synthetic data only and demonstrate the regression before correction.

## Evidence and next step
Parent read payroll list/detail pages, PDF route, PayrollService/Repository, BaseRepository, worker-utils and EncryptionService. Direct Prisma list/detail paths preserve organization filters; PDF repositories currently default to no tenant filter. Use shared server-side mapper with no ciphertext fallback; protect PDF lookup with session organization. No data or stored encryption changes. Implementation and independent source/test verification are complete. Focused command: `node node_modules/vitest/vitest.mjs run tests/unit/lib/payroll-worker-identity.test.ts tests/unit/pages/payroll-identity-pages.test.tsx tests/unit/api/payroll-pdf.test.tsx`. TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false`. No commit/push/merge or production operations. Rollback boundary is the new mapper, three presentation entry points and three regression files only. Separate R3/R4 readiness gates remain unresolved; this fix does not clear them.

## Merge-preparation follow-up
The earlier no-commit/no-push constraint described the original implementation session; the owner has since explicitly authorized reviewable commits and a push if needed to prepare this branch for merge. A fresh focused unit check on the current tree reported **3 files / 21 tests passed** with database-enabling variables removed; it did not run a browser, database, build or PDF visual check. This payroll slice contains only the server-only mapper, its three presentation entry points, these three regression files and this task record. The branch-wide readiness verdict remains separate and is not implied by this slice.
