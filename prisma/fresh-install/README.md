# Verification-only independent Prisma baseline

**VERIFICATION ONLY. This is not a supported production initialization or upgrade route.** The independent baseline lets an isolated, newly owned Docker database represent the committed schema while the historical chain remains broken. It does not repair, replace, merge with, or certify that chain.

## Review and execution

1. Review `scripts/test-prisma-fresh-install.mjs` and its pure safety tests independently before real execution.
2. Run `node --test tests/unit/scripts/prisma-fresh-install.test.mjs` (in-memory mocks; no Docker or temporary filesystem writes).
3. The parent/runtime owner may then run `node scripts/test-prisma-fresh-install.mjs` synchronously once against the explicit local Docker daemon. The source writer did not execute this runtime.

The harness accepts no external URLs, environment files, Docker contexts, repository mounts or command options. It never invokes the existing staging runners. Do not run this migration directory manually against an existing database.

## Provenance

| Artifact | Evidence |
| --- | --- |
| Committed candidate | `25187ef919fa4a2bbb4cb5bc2ae06c9220d4567b` |
| Dedicated schema | Semantically identical copy of committed `prisma/schema.prisma`; the copy removes one pre-existing trailing space so repository whitespace checks pass |
| Schema SHA-256 | `13e0c569d07c11bbe4e18f4d6bfd21c39cf97f35f64a51db0a069e3347c8e324` |
| Baseline SHA-256 | `6e778d283b1a622b2ac37275f8710fe3c290858975e6c57f41ea8848025e3b2f` |
| Generator | Parent-generated artifact; installed Prisma **5.22.0**, command below, exit 0 |
| Generator isolation | Parent reported sanitized scratch with no datasource or Docker contact; SQL was generated from the equivalent schema before removing only its trailing whitespace. The parent-owned runtime confirmed schema diff/catalog parity. |

Generation command recorded by the parent:

```text
node <installed-prisma-cli> migrate diff --from-empty --to-schema-datamodel schema.prisma --script
```

The 525-line SQL artifact was copied without reconstruction. Six historical CHECKs were appended by the parent; their definitions match the unchanged committed migrations:

| CHECK | Historical source |
| --- | --- |
| `worker_daily_rate_positive` | `20260902180000_add_worker_daily_pay` |
| `daily_pay_month_status_paid_at_consistency` | `20260902180000_add_worker_daily_pay` |
| `worker_day_company_name_nonempty` | `20260903120000_worker_day_operations`, reconciled by `20260904120000_reconcile_worker_day_checks` |
| `worker_day_segment_position_range` | Same worker-day migrations |
| `worker_day_segment_share_range` | Same worker-day migrations |
| `worker_day_segment_kilometers_nonnegative` | Same worker-day migrations |

Review of the six committed historical SQL files found no additional persistent triggers, functions, views, extensions, row-level-security policies, expression/partial indexes or custom DB objects to carry forward. Historical DO blocks include migration guards and a temporary CHECK reference; these procedural/data-lineage guards are intentionally **not** reproduced. This is not an inventory of a live production database.

## Isolation and assertions

- Docker uses an explicit local named pipe on Windows or local Unix socket elsewhere, an empty private Docker config, and an environment allowlist. No ambient `.env`, credentials, proxy or database variables are forwarded.
- Build context copies exactly the dedicated schema, baseline and migration lock, plus generated harness/package/Dockerfile content. Synthetic credentials are generated afterwards and never embedded in the image.
- Public build candidates: `node:22.14.0-bookworm-slim`, `postgres:16.6-bookworm`, Prisma `5.22.0`, and `pg` `8.13.1`. Image tags are version-pinned, **not digest-pinned**; npm resolves transitive packages during the build. No image digest or runtime success is claimed here.
- A unique owner label binds the image, internal network and two containers. Runtime has no external network, published ports, host mounts or persistent volumes. PostgreSQL data uses tmpfs.
- Both actual datasource URLs are independently connected and inspected in read-only transactions before any migration/reference write: database, role, server address/port, server system identifier and empty public catalog must match the owned server. Both generated URLs intentionally point to the same isolated database.
- Only the dedicated `migrate deploy` runs. A Prisma schema-datasource/datamodel `migrate diff --exit-code` must return zero.
- A second disposable reference database on the same proved server loads the exact baseline. PostgreSQL-normalized CHECK expressions and validation flags, primary/unique/foreign-key definitions, indexes, enum values/order and columns must equal the migrated catalog. Exactly six named validated CHECKs are required.
- The target ledger must contain exactly one completed, non-rolled-back baseline entry with the baseline checksum and one applied step.
- `finally` removes only exact owner-validated identifiers and verifies their absence, then removes only the unique scratch subtree. Ambiguous ownership/cleanup stops further cleanup actions and returns failure. Diagnostics expose only fixed phases, not URLs, credentials, environment or raw subprocess errors.

## Limits and next step

The default migration/deployment path is unchanged. Historical fresh deployment still fails because `Organization` is absent when `20260422182000_make_owner_id_optional` runs. Existing-production compatibility, historical ledger reconciliation, and supported fresh production installation remain **uncertified**.

Never use `migrate resolve`, `db push`, reset, ledger edits or checksum rewrites to connect these independent histories. Parent-owned runtime verification and cleanup must pass before T2 can close; passing source tests alone does not close that gate. On cleanup failure, retain ownership evidence for targeted investigation rather than retrying or pruning globally.
