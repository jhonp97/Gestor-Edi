# Push readiness blockers

## Goal and boundaries
Resolve the observed unit-suite timeout and validate a clean-database baseline in isolated Docker before pushing the feature branch. No production access, merge, deployment, commit-history rewrite, or changes to the original Prisma schema/history were authorized. The new baseline is strictly a verification harness, not a supported install/upgrade path.

Preserve all unrelated working-tree changes. Only the T1 and T2 files listed below are included in the intended commits.

## Work units

- [x] **T1 — Stabilize unit-suite resource use.** The transaction-form test waits for successful dialog closure/reset, retaining transaction-type/fixed-truck assertions and the 5-second timeout. Vitest uses `threads` with `maxWorkers: 2`, the exact combination that passed the full suite.
  - Exact-HEAD Linux snapshot plus only the test/config overlays: `node node_modules/vitest/vitest.mjs run tests/unit` — **693/693 passed** (76 files); focused transaction tests **4/4 passed**; `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed. Disposable container cleanup and absence were confirmed.
  - Commit: `c54d809` (`test: stabilize transaction form suite under bounded workers`).
- [x] **T2 — Add an isolated Prisma verification baseline.** Dedicated schema is semantically identical to the committed schema, with one trailing whitespace removed to satisfy diff checks; generated baseline includes six custom historical CHECKs. Historical migrations, checksums, default deployment route, and production lineage remain untouched.
  - `node --test tests/unit/scripts/prisma-fresh-install.test.mjs` — **21/21 passed**; harness syntax and scoped lint passed; independent source review **CLEAR**.
  - `node scripts/test-prisma-fresh-install.mjs` — native exit 0, `{ok:true, failure:null, cleanup:"passed"}`. The owned Docker run proved both datasource targets before writes, applied only the separate baseline, checked Prisma no-diff and PostgreSQL catalog/ledger parity, closed clients, and removed owned resources by immutable IDs.
  - Existing historical `prisma migrate deploy` on an empty database still fails because `Organization` is missing before a later ALTER. The separate baseline does not fix or certify production migration compatibility.
  - Commit: `776af53` (`test(db): add isolated Prisma baseline verification`).

## Remaining limits
App/browser integration, upgrade compatibility against the existing production database, backup/rollback, and deployment approval remain unverified. These commits only prepare and push the feature branch; they do not authorize merge or production deployment.

## Rollback boundaries
- T1: `tests/unit/components/transaction-form.test.tsx`, `vitest.config.ts`.
- T2: `prisma/fresh-install/**`, `scripts/test-prisma-fresh-install.mjs`, `tests/unit/scripts/prisma-fresh-install.test.mjs`, and this task record.
