import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8')
const migration = readFileSync(resolve(root, 'prisma/migrations/20261007161500_link_worker_day_mileage/migration.sql'), 'utf8')

test('derived mileage is uniquely tied to a worker-day segment and cascades with it', () => {
  assert.match(schema, /sourceWorkerDaySegmentId\s+String\?\s+@unique/)
  assert.match(schema, /sourceWorkerDaySegment\s+WorkerDayTruckSegment\?\s+@relation\("WorkerDayMileage"[^\n]*onDelete:\s*Cascade\)/)
  assert.match(schema, /mileageRecord\s+TruckMileage\?\s+@relation\("WorkerDayMileage"\)/)
  assert.match(migration, /ADD COLUMN "sourceWorkerDaySegmentId" TEXT/)
  assert.match(migration, /CREATE UNIQUE INDEX "TruckMileage_sourceWorkerDaySegmentId_key"/)
  assert.match(migration, /FOREIGN KEY \("sourceWorkerDaySegmentId"\)\s+REFERENCES "WorkerDayTruckSegment"\("id"\)\s+ON DELETE CASCADE/)
  const statements = migration.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n')
  assert.doesNotMatch(statements, /(?:^|;)\s*(?:UPDATE|INSERT|DELETE)\b/i)
})
