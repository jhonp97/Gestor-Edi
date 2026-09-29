// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const enabled = process.env.RUN_ISOLATED_MIGRATION_TEST === '1'
const suite = enabled ? describe : describe.skip
const name = `worker-day-check-${randomUUID()}`
const migration = resolve(process.cwd(), 'prisma/migrations/20260904120000_reconcile_worker_day_checks/migration.sql')
const source = resolve(process.cwd(), 'prisma/migrations/20260903120000_worker_day_operations/migration.sql')

suite('worker-day CHECK reconciliation in isolated PostgreSQL', () => {
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 30_000, env: { PATH: process.env.PATH, NODE_ENV: 'test' } })
  const sql = (text: string) => execFileSync('docker', ['exec', '-i', name, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-At'], {
    input: text, encoding: 'utf8', timeout: 30_000, env: { PATH: process.env.PATH, NODE_ENV: 'test' },
  }).trim()
  const apply = () => sql(readFileSync(migration, 'utf8'))
  const definitions = () => sql(`SELECT conname || ':' || convalidated::text || ':' || pg_get_constraintdef(oid)
    FROM pg_constraint WHERE conrelid IN ('"WorkerDayOperation"'::regclass, '"WorkerDayTruckSegment"'::regclass)
    AND conname LIKE 'worker_day_%' ORDER BY conname`).split('\n').filter(Boolean)

  beforeAll(() => {
    docker('run', '-d', '--pull=never', '--network', 'none', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17')
    let ready = false
    for (let attempt = 0; attempt < 30; attempt++) {
      try { docker('exec', name, 'pg_isready', '-U', 'postgres'); ready = true; break } catch { /* starting */ }
    }
    if (!ready) throw new Error('Isolated PostgreSQL did not become ready')
    sql(`CREATE TABLE "DailyPayDay" ("id" text PRIMARY KEY);
      CREATE TABLE "Organization" ("id" text PRIMARY KEY);
      CREATE TABLE "Truck" ("id" text PRIMARY KEY);
      INSERT INTO "DailyPayDay" VALUES ('day');
      INSERT INTO "Organization" VALUES ('org');
      INSERT INTO "Truck" VALUES ('truck');`)
  })
  afterAll(() => {
    try { docker('rm', '-f', name) } catch { /* no container if startup failed */ }
  })

  it('adds four validated checks and enforces the values while allowing valid and null kilometers', () => {
    sql(readFileSync(source, 'utf8').replace(/,\s*CONSTRAINT "worker_day_[^\n]+CHECK \([^\n]+\)/g, ''))
    expect(definitions()).toEqual([])
    apply()
    expect(definitions()).toHaveLength(4)
    expect(definitions().every(def => def.includes(':true:CHECK '))).toBe(true)
    sql(`INSERT INTO "WorkerDayOperation" ("id", "dailyPayDayId", "companyName", "organizationId", "updatedAt") VALUES ('op', 'day', 'Carrier', 'org', now());`)
    const bad = (statement: string) => expect(() => sql(statement)).toThrow()
    bad(`UPDATE "WorkerDayOperation" SET "companyName" = '   ' WHERE "id" = 'op';`)
    const segment = (id: string, position: number, share: number, km: string) =>
      `INSERT INTO "WorkerDayTruckSegment" ("id", "operationId", "truckId", "workDate", "position", "share", "kilometers", "organizationId") VALUES ('${id}', 'op', 'truck', '2026-09-04', ${position}, ${share}, ${km}, 'org');`
    bad(segment('bad-position', 0, 50, 'NULL'))
    bad(segment('bad-share', 1, 0, 'NULL'))
    bad(segment('bad-km', 1, 100, '-1'))
    sql(segment('valid', 1, 100, 'NULL'))
    sql(`UPDATE "WorkerDayTruckSegment" SET "kilometers" = 12.5 WHERE "id" = 'valid';`)
  }, 30_000)

  it('does not alter already-present checks on repeated application', () => {
    const before = definitions()
    apply()
    apply()
    expect(definitions()).toEqual(before)
  }, 30_000)

  it('fails closed on a same-named different CHECK', () => {
    sql(`ALTER TABLE "WorkerDayTruckSegment" DROP CONSTRAINT "worker_day_segment_share_range";
      ALTER TABLE "WorkerDayTruckSegment" ADD CONSTRAINT "worker_day_segment_share_range" CHECK ("share" >= 0);`)
    expect(() => apply()).toThrow()
  })
})
