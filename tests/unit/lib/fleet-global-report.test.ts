// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const db = vi.hoisted(() => ({ truck: { findMany: vi.fn() }, transaction: { findMany: vi.fn() }, workerDayTruckSegment: { findMany: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
import { loadFleetGlobalReport, InvalidGlobalFleetSelectionError, GlobalFleetReportTooLargeError } from '@/lib/fleet-global-report'
const load = (ids = ['a', 'b'], month = '2026-03', period: 'month' | 'quarter' | 'half-year' | 'year' = 'month') => loadFleetGlobalReport('org', ids, month, period)
const segment = (id: string, truckId: string, workerId: string, share: number, date = '2026-03-02', companyName = 'Client') => ({ id, truckId, workDate: new Date(`${date}T00:00:00Z`), share, operation: { companyName, dailyPayDay: { worker: { id: workerId, name: workerId } } } })
beforeEach(() => {
  vi.resetAllMocks()
  db.truck.findMany.mockResolvedValue([{ id: 'b', plate: 'B' }, { id: 'a', plate: 'A' }])
  db.transaction.findMany.mockResolvedValue([])
  db.workerDayTruckSegment.findMany.mockResolvedValue([])
})
it.each([[], ['a', 'a'], [''], ['a\n'], ['all'], Array.from({ length: 101 }, (_, i) => `t${i}`)].map(ids => [ids]))('rejects invalid selection %j before data access', async ids => {
  await expect(load(ids)).rejects.toBeInstanceOf(InvalidGlobalFleetSelectionError)
  expect(db.truck.findMany).not.toHaveBeenCalled()
})
it.each(['bad', '2026-13', '2026-3'])('rejects malformed month %s', async month => {
  await expect(load(['a'], month)).rejects.toBeInstanceOf(InvalidGlobalFleetSelectionError)
  expect(db.truck.findMany).not.toHaveBeenCalled()
})
it('authorizes every truck before any operational or financial read', async () => {
  db.truck.findMany.mockResolvedValue([{ id: 'a', plate: 'A' }])
  await expect(load()).rejects.toBeInstanceOf(InvalidGlobalFleetSelectionError)
  expect(db.truck.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org', id: { in: ['a', 'b'] } } }))
  expect(db.transaction.findMany).not.toHaveBeenCalled()
  expect(db.workerDayTruckSegment.findMany).not.toHaveBeenCalled()
})
it('deduplicates dates at each scope and sums selected shares only, without salary', async () => {
  db.workerDayTruckSegment.findMany.mockResolvedValue([
    segment('1', 'a', 'w', 50), segment('2', 'b', 'w', 50), segment('3', 'a', 'z', 100),
    segment('4', 'b', 'w', 25, '2026-03-03', 'Other'),
  ])
  const report = await load()
  expect(report.totals).toEqual({ truckDays: 3, calendarDays: 2, workerDays: 3, equivalentDays: '2.25', fuelExpense: '0.00' })
  expect(report.trucks).toEqual([{ id: 'a', plate: 'A', operationalDays: 1, equivalentDays: '1.5', fuelExpense: '0.00' }, { id: 'b', plate: 'B', operationalDays: 2, equivalentDays: '0.75', fuelExpense: '0.00' }])
  expect(report.workers).toEqual([{ id: 'w', name: 'w', days: 2, equivalentDays: '1.25' }, { id: 'z', name: 'z', days: 1, equivalentDays: '1' }])
  expect(report.companies).toEqual([{ name: 'Client', truckDays: 2, workerDays: 2, equivalentDays: '2' }, { name: 'Other', truckDays: 1, workerDays: 1, equivalentDays: '0.25' }])
  expect(db.workerDayTruckSegment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org', truckId: { in: ['a', 'b'] }, truck: { organizationId: 'org' }, operation: { organizationId: 'org', dailyPayDay: { organizationId: 'org', worker: { organizationId: 'org' } } } }) }))
  expect(JSON.stringify(db.workerDayTruckSegment.findMany.mock.calls)).not.toContain('rateSnapshot')
})
it('counts only exact normalized Combustible EXPENSE with decimal arithmetic, never activity from transactions', async () => {
  db.transaction.findMany.mockResolvedValue([
    { id: '1', truckId: 'a', type: 'EXPENSE', category: ' Combustible ', amount: 0.1 },
    { id: '2', truckId: 'b', type: 'EXPENSE', category: 'COMBUSTIBLE', amount: 0.2 },
    { id: '3', truckId: 'a', type: 'INCOME', category: 'Combustible', amount: 99 },
    { id: '4', truckId: 'a', type: 'EXPENSE', category: 'Combustible extra', amount: 99 },
    { id: '5', truckId: 'a', type: 'EXPENSE', category: null, amount: 99 },
  ])
  const report = await load()
  expect(report.totals).toEqual({ truckDays: 0, calendarDays: 0, workerDays: 0, equivalentDays: '0', fuelExpense: '0.30' })
  expect(report.trucks.map(t => t.fuelExpense)).toEqual(['0.10', '0.20'])
  expect(report.workers).toEqual([])
  expect(report.companies).toEqual([])
})
it.each([['month', '2026-03-01', '2026-04-01'], ['quarter', '2026-01-01', '2026-04-01'], ['half-year', '2026-01-01', '2026-07-01'], ['year', '2026-01-01', '2027-01-01']] as const)('uses complete %s civil period and Madrid financial bounds', async (period, start, end) => {
  const report = await load(['a', 'b'], '2026-03', period)
  expect(report.period).toBe(period)
  expect(report.periodLabel).toBeTruthy()
  const where = db.workerDayTruckSegment.findMany.mock.calls[0][0].where
  expect(where.workDate).toEqual({ gte: new Date(start), lt: new Date(end) })
  expect(db.transaction.findMany.mock.calls[0][0].where).toMatchObject({ type: 'EXPENSE', date: { gte: new Date(`${start}T00:00:00+01:00`), lt: new Date(`${end}T00:00:00${period === 'year' ? '+01:00' : '+02:00'}`) } })
})
it('paginates by bounded advancing ids and includes later rows', async () => {
  db.transaction.findMany.mockResolvedValueOnce(Array.from({ length: 200 }, (_, i) => ({ id: String(i).padStart(4, '0'), truckId: 'a', type: 'EXPENSE', category: 'Combustible', amount: 0.1 }))).mockResolvedValueOnce([{ id: '0200', truckId: 'a', type: 'EXPENSE', category: 'Combustible', amount: 0.2 }])
  expect((await load()).totals.fuelExpense).toBe('20.20')
  expect(db.transaction.findMany.mock.calls[1][0]).toMatchObject({ take: 200, orderBy: { id: 'asc' }, where: { id: { gt: '0199' } } })
})
it('returns explicit zeros for a selection with no records', async () => {
  const report = await load()
  expect(report.totals).toEqual({ truckDays: 0, calendarDays: 0, workerDays: 0, equivalentDays: '0', fuelExpense: '0.00' })
  expect(report.trucks.every(t => t.operationalDays === 0 && t.equivalentDays === '0' && t.fuelExpense === '0.00')).toBe(true)
})
it('rejects nonprogressing pages rather than looping or truncating', async () => {
  db.transaction.findMany.mockResolvedValue(Array.from({ length: 200 }, (_, i) => ({ id: String(i).padStart(4, '0'), truckId: 'a', type: 'EXPENSE', category: 'Other', amount: 0 })))
  await expect(load()).rejects.toBeInstanceOf(GlobalFleetReportTooLargeError)
})
it('rejects more than 50000 records explicitly', async () => {
  let n = 0
  db.transaction.findMany.mockImplementation(async () => Array.from({ length: 200 }, () => ({ id: String(n++).padStart(6, '0'), truckId: 'a', type: 'EXPENSE', category: 'Other', amount: 0 })))
  await expect(load()).rejects.toBeInstanceOf(GlobalFleetReportTooLargeError)
})
