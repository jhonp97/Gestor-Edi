// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const db = vi.hoisted(() => ({ truck: { findMany: vi.fn() }, transaction: { findMany: vi.fn() }, workerDayTruckSegment: { findMany: vi.fn() }, truckMileage: { findMany: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
import { loadTruckMonthlyExport, ExportTooLargeError } from '@/lib/truck-monthly-export'

const date = new Date('2026-03-01T00:00:00Z')
function segment(id: string, workerId = 'w1', truckId = 'a', share = 50) {
  return { id, truckId, workDate: date, share, kilometers: 9999, operation: { companyName: 'Synthetic Company', dailyPayDay: { worker: { id: workerId, name: 'Synthetic Worker' } } } }
}
beforeEach(() => {
  vi.resetAllMocks()
  db.truck.findMany.mockImplementation(async ({ where }) => [{ id: 'a', plate: 'AAA' }, { id: 'b', plate: 'BBB' }].filter(truck => !where.id || truck.id === where.id))
  db.transaction.findMany.mockResolvedValue([])
  db.workerDayTruckSegment.findMany.mockResolvedValue([])
  db.truckMileage.findMany.mockResolvedValue([])
})
it('folds more than 50 movements across deterministic tenant-scoped batches without duplicating money', async () => {
  const rows = Array.from({ length: 201 }, (_, i) => ({ id: `t${String(i).padStart(3, '0')}`, truckId: 'a', date, type: 'INCOME', amount: 0.1 }))
  db.transaction.findMany.mockResolvedValueOnce(rows.slice(0, 200)).mockResolvedValueOnce(rows.slice(200))
  db.workerDayTruckSegment.findMany.mockImplementation(async ({ where }) => where.truckId === 'a' ? [segment('s1'), segment('s2', 'w2')] : [])
  const report = await loadTruckMonthlyExport('org', 'all', '2026-03')
  expect(report.trucks[0].days[0].income).toBe('20.10')
  expect(report.trucks[0].totals).toMatchObject({ income: '20.10', expense: '0.00', net: '20.10' })
  expect(db.transaction.findMany).toHaveBeenCalledTimes(3) // Two batches for a; one empty batch for b.
  expect(db.transaction.findMany.mock.calls[1][0]).toMatchObject({ where: { organizationId: 'org', id: { gt: 't199' } }, orderBy: { id: 'asc' }, take: 200 })
  for (const model of Object.values(db)) for (const [query] of model.findMany.mock.calls) expect(query.where.organizationId).toBe('org')
  expect(db.workerDayTruckSegment.findMany.mock.calls[0][0]).toMatchObject({ where: { operation: { organizationId: 'org', dailyPayDay: { organizationId: 'org', worker: { organizationId: 'org' } } } }, select: { operation: { select: { dailyPayDay: { select: { worker: { select: { id: true, name: true } } } } } } } })
  expect(db.workerDayTruckSegment.findMany.mock.calls[0][0].select).not.toHaveProperty('kilometers')
})
it('counts worker IDs and distinct dates per truck, including same names and shared assignments', async () => {
  db.workerDayTruckSegment.findMany.mockImplementation(async ({ where }) => [segment('s1'), segment('s2', 'w2'), segment('s3', 'w1', 'b'), segment('s4', 'w1', 'a', 25)].filter(row => row.truckId === where.truckId))
  const report = await loadTruckMonthlyExport('org', 'all', '2026-03')
  expect(report.trucks[0].workers).toEqual([
    { id: 'w1', name: 'Synthetic Worker', dates: 1, equivalentDays: '0.75' },
    { id: 'w2', name: 'Synthetic Worker', dates: 1, equivalentDays: '0.5' },
  ])
  expect(report.trucks[1].workers[0]).toMatchObject({ dates: 1, equivalentDays: '0.5' })
})
it('uses only additive civil TruckMileage records, distinguishes missing and zero, and sorts date union', async () => {
  db.workerDayTruckSegment.findMany.mockResolvedValue([segment('s')])
  db.truckMileage.findMany.mockResolvedValue([
    { id: 'm1', truckId: 'a', date: new Date('2026-03-02'), km: 0 },
    { id: 'm2', truckId: 'a', date: new Date('2026-03-03'), km: 10.1 },
    { id: 'm3', truckId: 'a', date: new Date('2026-03-03'), km: 0.2 },
  ])
  const truck = (await loadTruckMonthlyExport('org', 'a', '2026-03')).trucks[0]
  expect(truck.days.map(d => [d.date, d.km])).toEqual([['2026-03-01', null], ['2026-03-02', '0'], ['2026-03-03', '10.3']])
  expect(truck.totals.km).toBe('10.3')
  expect(truck.days[0].income).toBeNull()
})
it.each([
  ['2026-03', '2026-02-28T23:00:00.000Z', '2026-03-31T22:00:00.000Z'],
  ['2026-10', '2026-09-30T22:00:00.000Z', '2026-10-31T23:00:00.000Z'],
])('queries Madrid financial and UTC civil boundaries for %s', async (month, start, end) => {
  db.transaction.findMany.mockResolvedValue([{ id: 't', truckId: 'a', date: new Date(start), type: 'EXPENSE', amount: 0.2 }])
  const report = await loadTruckMonthlyExport('org', 'a', month)
  expect(report.trucks[0].days[0].date).toBe(`${month}-01`)
  expect(db.transaction.findMany.mock.calls[0][0].where.date).toEqual({ gte: new Date(start), lt: new Date(end) })
  for (const model of [db.truckMileage, db.workerDayTruckSegment]) {
    const query = model.findMany.mock.calls[0][0]
    expect(query.where[model === db.truckMileage ? 'date' : 'workDate'].gte).toEqual(new Date(`${month}-01T00:00:00Z`))
  }
  expect(report.trucks[0].totals.net).toBe('-0.20')
})
it('rejects inaccessible truck before querying any details', async () => {
  db.truck.findMany.mockResolvedValue([])
  await expect(loadTruckMonthlyExport('org', 'foreign', '2026-03')).rejects.toThrow('Truck not found')
  expect(db.transaction.findMany).not.toHaveBeenCalled()
})
it('rejects oversized exports explicitly instead of returning a partial model', async () => {
  let offset = 0
  db.transaction.findMany.mockImplementation(async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: `t${String(offset + i).padStart(6, '0')}`, date, type: 'INCOME', amount: 1 }))
    offset += 200
    return rows
  })
  await expect(loadTruckMonthlyExport('org', 'a', '2026-03')).rejects.toBeInstanceOf(ExportTooLargeError)
  expect(offset).toBe(50000) // The authorized truck also counts toward the 50,000-record bound.
})
it('loads complete segments and mileage beyond a batch and retains civil date keys at UTC midnight', async () => {
  const segments = Array.from({ length: 201 }, (_, i) => ({ ...segment(`s${String(i).padStart(3, '0')}`, `w${i}`), workDate: new Date('2026-03-31T00:00:00Z') }))
  const mileages = Array.from({ length: 201 }, (_, i) => ({ id: `m${String(i).padStart(3, '0')}`, date: new Date('2026-03-31T00:00:00Z'), km: 1 }))
  db.workerDayTruckSegment.findMany.mockResolvedValueOnce(segments.slice(0, 200)).mockResolvedValueOnce(segments.slice(200))
  db.truckMileage.findMany.mockResolvedValueOnce(mileages.slice(0, 200)).mockResolvedValueOnce(mileages.slice(200))
  const report = await loadTruckMonthlyExport('org', 'a', '2026-03')
  expect(report.trucks[0].days[0]).toMatchObject({ date: '2026-03-31', km: '201' })
  expect(report.trucks[0].days[0].workers).toHaveLength(201)
  expect(report.trucks[0].workers).toHaveLength(201)
  for (const [model, id] of [[db.workerDayTruckSegment, 's199'], [db.truckMileage, 'm199']] as const) {
    expect(model.findMany.mock.calls[1][0]).toMatchObject({ where: { organizationId: 'org', truckId: 'a', id: { gt: id } } })
  }
})
it('shows exactly one date and half an equivalent day for each truck on a shared day', async () => {
  db.workerDayTruckSegment.findMany.mockImplementation(async ({ where }) => [segment('sa', 'w', 'a'), segment('sb', 'w', 'b')].filter(row => row.truckId === where.truckId))
  const report = await loadTruckMonthlyExport('org', 'all', '2026-03')
  for (const truck of report.trucks) expect(truck.workers).toEqual([{ id: 'w', name: 'Synthetic Worker', dates: 1, equivalentDays: '0.5' }])
})
