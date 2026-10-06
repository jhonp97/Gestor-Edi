import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const queries = vi.hoisted(() => ({ countDays: vi.fn().mockResolvedValue(0), transactionAnchor: vi.fn().mockResolvedValue({ id: 'anchor' }), segmentAnchor: vi.fn().mockResolvedValue({ id: 'anchor' }), transactions: vi.fn().mockResolvedValue([]), segments: vi.fn().mockResolvedValue([]), trucks: vi.fn().mockResolvedValue([{ id: 'truck-a', plate: 'AAA' }, { id: 'truck-b', plate: 'BBB' }]) }))
vi.mock('@/lib/prisma', () => ({ prisma: { dailyPayDay: { count: queries.countDays }, transaction: { findMany: queries.transactions, findFirst: queries.transactionAnchor }, workerDayTruckSegment: { findMany: queries.segments, findFirst: queries.segmentAnchor }, truck: { findMany: queries.trucks } } }))
import { madridMonthRange, resolveReportMonth, resolveReportPeriod, madridPeriodRange, recordedTotals, loadTruckMonthlyReport, loadFleetMonthlyReport, recordedAmount, sanitizeTransactionFilters } from '@/lib/truck-monthly-report'

beforeEach(() => { queries.countDays.mockReset().mockResolvedValue(0); queries.transactionAnchor.mockReset().mockResolvedValue({ id: 'anchor' }); queries.segmentAnchor.mockReset().mockResolvedValue({ id: 'anchor' }); queries.transactions.mockReset().mockResolvedValue([]); queries.segments.mockReset().mockResolvedValue([]); queries.trucks.mockReset().mockResolvedValue([{ id: 'truck-a', plate: 'AAA' }, { id: 'truck-b', plate: 'BBB' }]) })

describe('bounded monthly details', () => {
  it.each(['truck', 'fleet'])('navigates %s ties in both directions without duplicates and retains full totals', async kind => {
    const transactions = Array.from({ length: 103 }, (_, i) => ({ id: `t${String(102 - i).padStart(3, '0')}`, truckId: 'truck-a', date: new Date('2026-03-10'), type: 'INCOME', amount: 1.005, description: 'Recorded', category: null }))
    const segments = transactions.map(row => ({ id: row.id.replace('t', 's'), truckId: row.truckId, workDate: row.date, share: 100, kilometers: null, incident: null, operation: { companyName: 'Co', dailyPayDay: { id: 'shared-day', worker: { name: 'Ana' } } } }))
    const detail = <T extends { id: string }>(rows: T[], args: { take: number; orderBy: unknown; cursor?: { id: string }; skip?: number }) => {
      expect(args.take).toBe(51)
      const forward = JSON.stringify(args.orderBy).includes('desc')
      const ordered = forward ? rows : [...rows].reverse()
      const index = args.cursor ? ordered.findIndex(row => row.id === args.cursor!.id) : -1
      if (args.cursor) { expect(index).toBeGreaterThanOrEqual(0); expect(args.skip).toBe(1) }
      return ordered.slice(index + 1, index + 52)
    }
    queries.transactions.mockImplementation(async args => args.take === 200 ? transactions : detail(transactions, args))
    queries.segments.mockImplementation(async args => detail(segments, args))
    queries.countDays.mockResolvedValue(1)
    const load = (transactions?: string, segments?: string) => kind === 'truck' ? loadTruckMonthlyReport('tenant-a', 'truck-a', '2026-03', { transactions, segments }) : loadFleetMonthlyReport('tenant-a', 'truck-a', '2026-03', 'month', { transactions, segments })
    const first = await load()
    const second = await load(first.pages.transactions.next!, first.pages.segments.next!)
    const last = await load(second.pages.transactions.next!, second.pages.segments.next!)
    const back = await load(last.pages.transactions.previous!, last.pages.segments.previous!)
    const home = await load(back.pages.transactions.previous!, back.pages.segments.previous!)
    expect([...first.transactions, ...second.transactions, ...last.transactions].map(row => row.id)).toEqual(transactions.map(row => row.id))
    expect([...first.segments, ...second.segments, ...last.segments].map(row => row.id)).toEqual(segments.map(row => row.id))
    expect(back.transactions).toEqual(second.transactions)
    expect(back.segments).toEqual(second.segments)
    expect(home.transactions).toEqual(first.transactions)
    expect(home.pages.transactions.previous).toBeNull()
    expect(last.pages.transactions).toMatchObject({ count: 3, next: null, hasMore: false })
    for (const report of [first, second, last, back, home]) expect(report.totals).toEqual({ income: '103.52', expense: '0.00' })
    for (const [args] of queries.transactions.mock.calls) {
      expect(args.where).toEqual({ organizationId: 'tenant-a', truckId: 'truck-a', type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: new Date('2026-02-28T23:00:00Z'), lt: new Date('2026-03-31T22:00:00Z') } })
      if (args.take === 51) expect(args.orderBy).toEqual(args.cursor?.id === 't002' || args.cursor?.id === 't052' ? [{ date: 'asc' }, { id: 'asc' }] : [{ date: 'desc' }, { id: 'desc' }])
    }
    for (const [args] of queries.segments.mock.calls) {
      expect(args.where).toEqual({ organizationId: 'tenant-a', truckId: 'truck-a', workDate: { gte: new Date('2026-03-01'), lt: new Date('2026-04-01') }, operation: { organizationId: 'tenant-a', dailyPayDay: { organizationId: 'tenant-a', worker: { organizationId: 'tenant-a' } } } })
      expect(args.orderBy).toEqual(args.cursor?.id === 's002' || args.cursor?.id === 's052' ? [{ workDate: 'asc' }, { id: 'asc' }] : [{ workDate: 'desc' }, { id: 'desc' }])
    }
    expect(queries.transactionAnchor).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-a', truckId: 'truck-a', id: 't053' }) }))
    if (kind === 'fleet') {
      expect(last).toMatchObject({ workerDays: 1, byTruck: [{ totals: { income: '103.52', expense: '0.00' } }] })
      expect(queries.countDays).toHaveBeenCalledWith({ where: { organizationId: 'tenant-a', worker: { organizationId: 'tenant-a' }, workDate: { gte: new Date('2026-03-01'), lt: new Date('2026-04-01') }, operation: { is: { organizationId: 'tenant-a', segments: { some: { organizationId: 'tenant-a', truckId: 'truck-a', workDate: { gte: new Date('2026-03-01'), lt: new Date('2026-04-01') } } } } } } })
    }
  })
  it.each(['truck', 'fleet'])('streams complete %s monthly amounts in finite batches independently of each visible list', async kind => {
    const all = Array.from({ length: 401 }, (_, i) => ({ id: `t${String(i).padStart(3, '0')}`, truckId: 'truck-a', type: i % 2 ? 'EXPENSE' : 'INCOME', amount: 1.005 }))
    const visible = { ...all[400], date: new Date('2026-03-30'), description: 'Last row', category: null }
    queries.transactions.mockImplementation(async args => {
      if (args.take === 51) return [visible]
      expect(args.take).toBe(200)
      expect(args.orderBy).toEqual({ id: 'asc' })
      const start = args.cursor ? all.findIndex(row => row.id === args.cursor.id) + 1 : 0
      if (args.cursor) expect(args.skip).toBe(1)
      return all.slice(start, start + args.take)
    })
    const report = kind === 'truck' ? await loadTruckMonthlyReport('tenant-a', 'truck-a', '2026-03', { transactions: 'next:t399' }) : await loadFleetMonthlyReport('tenant-a', 'truck-a', '2026-03', 'month', { transactions: 'next:t399' })
    expect(report.transactions).toEqual([visible])
    expect(report.totals).toEqual(recordedTotals(all))
    expect(report.totals).toEqual({ income: '202.01', expense: '201.00' })
    expect(queries.transactions.mock.calls.filter(([args]) => args.take === 200).map(([args]) => args.cursor?.id)).toEqual([undefined, 't199', 't399'])
    expect(queries.segments).toHaveBeenCalledWith(expect.objectContaining({ take: 51, orderBy: [{ workDate: 'desc' }, { id: 'desc' }] }))
    expect(queries.segments.mock.lastCall?.[0]).not.toHaveProperty('cursor')
    expect(report.pages.segments.current).toBeUndefined()
    if (kind === 'fleet') expect(report).toMatchObject({ byTruck: [{ totals: recordedTotals(all) }] })
  })
  it('keeps independent cursor state and rejects malformed, repeated, foreign or stale anchors', async () => {
    for (const value of ['', 'bad', 'next:bad/id', ['next:a', 'next:b'], 'prev:', 'next:' + 'a'.repeat(161)]) {
      await expect(loadTruckMonthlyReport('tenant-a', 'truck-a', '2026-03', { transactions: value })).rejects.toThrow('Invalid report cursor')
      await expect(loadFleetMonthlyReport('tenant-a', 'all', '2026-03', 'month', { segments: value })).rejects.toThrow('Invalid report cursor')
    }
    expect(queries.transactions).not.toHaveBeenCalled()
    queries.transactionAnchor.mockResolvedValueOnce(null)
    await expect(loadTruckMonthlyReport('tenant-a', 'truck-a', '2026-03', { transactions: 'next:foreign' })).rejects.toThrow('Transaction cursor not found')
    queries.segmentAnchor.mockResolvedValueOnce(null)
    await expect(loadFleetMonthlyReport('tenant-a', 'all', '2026-03', 'month', { segments: 'prev:foreign' })).rejects.toThrow('Segment cursor not found')
    await expect(loadTruckMonthlyReport('tenant-a', 'truck-a', '2026-03', { segments: 'next:deleted' })).rejects.toThrow('Empty cursor page')
    await expect(loadFleetMonthlyReport('tenant-a', 'all', '2026-03', 'year', { transactions: 'next:a' })).rejects.toThrow('Aggregate period has no details')
  })
  it.each(['truck', 'fleet'])('limits %s detail queries to 50 plus a sentinel with stable ties', async kind => {
    if (kind === 'truck') await loadTruckMonthlyReport('tenant-a', 'truck-a', '2026-03')
    else await loadFleetMonthlyReport('tenant-a', 'all', '2026-03')
    expect(queries.transactions).toHaveBeenCalledWith(expect.objectContaining({ take: 51, orderBy: [{ date: 'desc' }, { id: 'desc' }] }))
    expect(queries.segments).toHaveBeenCalledWith(expect.objectContaining({ take: 51, orderBy: [{ workDate: 'desc' }, { id: 'desc' }] }))
  })
})

describe('fleet monthly report', () => {
  it('resolves calendar periods across year and DST boundaries', () => {
    expect(resolveReportPeriod(undefined)).toBe('month')
    for (const invalid of ['weekly', '', ['quarter', 'year']]) expect(() => resolveReportPeriod(invalid)).toThrow()
    expect(madridPeriodRange('2026-12', 'quarter')).toEqual({ start: new Date('2026-09-30T22:00:00Z'), end: new Date('2026-12-31T23:00:00Z'), civilStart: new Date('2026-10-01T00:00:00Z'), civilEnd: new Date('2027-01-01T00:00:00Z') })
    expect(madridPeriodRange('2026-03', 'half-year').end).toEqual(new Date('2026-06-30T22:00:00Z'))
    expect(madridPeriodRange('2026-08', 'half-year').civilStart).toEqual(new Date('2026-07-01T00:00:00Z'))
    expect(madridPeriodRange('2026-01', 'year').end).toEqual(new Date('2026-12-31T23:00:00Z'))
  })
  it('pages aggregate-only rows with exact decimal totals and unique split days', async () => {
    const transaction = (id: string, truckId: string) => ({ id, truckId, type: 'INCOME', amount: 1.005 })
    const transactions = Array.from({ length: 201 }, (_, i) => transaction(`t${String(i).padStart(3, '0')}`, i === 0 || i === 200 ? 'truck-a' : 'truck-b'))
    queries.countDays.mockResolvedValueOnce(2)
    const page = <T extends { id: string }>(rows: T[], args: { cursor?: { id: string }; skip?: number; take: number; orderBy: { id: string } }) => {
      expect(args.orderBy).toEqual({ id: 'asc' })
      expect(args.take).toBe(200)
      const index = args.cursor ? rows.findIndex(row => row.id === args.cursor!.id) : -1
      if (args.cursor) { expect(index).toBeGreaterThanOrEqual(0); expect(args.skip).toBe(1) }
      return rows.slice(index + 1, index + 1 + args.take)
    }
    queries.transactions.mockImplementation(async args => { expect(queries.transactions.mock.calls.length).toBeLessThanOrEqual(3); return page(transactions, args) })
    queries.segments.mockRejectedValue(new Error('Aggregate must not read segments'))
    const report = await loadFleetMonthlyReport('tenant-a', 'all', '2026-03', 'year')
    expect(report.transactions).toEqual([])
    expect(report.segments).toEqual([])
    expect(report.workerDays).toBe(2)
    expect(report.totals.income).toBe('202.01')
    expect(report.byTruck.map(truck => truck.totals.income)).toEqual(['2.01', '200.00'])
    expect(queries.transactions.mock.calls.at(-1)?.[0]).toMatchObject({ cursor: { id: 't199' }, skip: 1 })
    expect(queries.segments).not.toHaveBeenCalled()
    expect(queries.transactions.mock.lastCall?.[0]).toMatchObject({ where: { organizationId: 'tenant-a', truckId: { in: ['truck-a', 'truck-b'] }, date: { gte: new Date('2025-12-31T23:00:00Z'), lt: new Date('2026-12-31T23:00:00Z') } }, select: { id: true, truckId: true, type: true, amount: true } })
    expect(queries.countDays).toHaveBeenCalledWith({ where: { organizationId: 'tenant-a', worker: { organizationId: 'tenant-a' }, workDate: { gte: new Date('2026-01-01T00:00:00Z'), lt: new Date('2027-01-01T00:00:00Z') }, operation: { is: { organizationId: 'tenant-a', segments: { some: { organizationId: 'tenant-a', truckId: { in: ['truck-a', 'truck-b'] }, workDate: { gte: new Date('2026-01-01T00:00:00Z'), lt: new Date('2027-01-01T00:00:00Z') } } } } } } })
  })
  it('terminates after an exact full batch followed by an empty page, filtering one owned truck', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: `t${String(i).padStart(3, '0')}`, truckId: 'truck-a', type: 'INCOME', amount: 0.01 }))
    queries.transactions.mockImplementation(async args => {
      expect(queries.transactions.mock.calls.length).toBeLessThanOrEqual(2)
      expect(args.where.truckId).toBe('truck-a')
      return args.cursor ? (expect(args).toMatchObject({ cursor: { id: 't199' }, skip: 1 }), []) : rows
    })
    queries.segments.mockImplementation(async args => { expect(args.where.truckId).toBe('truck-a'); return [] })
    const report = await loadFleetMonthlyReport('tenant-a', 'truck-a', '2026-03', 'quarter')
    expect(report.totals.income).toBe('2.00')
    expect(report.byTruck).toHaveLength(1)
    expect(queries.transactions).toHaveBeenCalledTimes(2)
  })
  it('does not query rows for an empty owned fleet', async () => {
    queries.trucks.mockResolvedValueOnce([])
    queries.transactions.mockClear(); queries.segments.mockClear()
    const report = await loadFleetMonthlyReport('tenant-a', 'all', '2026-03')
    expect(report.trucks).toEqual([])
    expect(report.totals).toEqual({ income: '0.00', expense: '0.00' })
    expect(report.workerDays).toBe(0)
    expect(queries.transactions).not.toHaveBeenCalled()
    expect(queries.segments).not.toHaveBeenCalled()
  })
  it('rounds fleet and individual truck aggregates independently from raw cents', async () => {
    queries.transactions.mockImplementation(async args => args.take === 200 ? [
      { id: 'a', truckId: 'truck-a', type: 'INCOME', amount: 1.005 },
      { id: 'b', truckId: 'truck-b', type: 'INCOME', amount: 1.005 },
    ] : [])
    const report = await loadFleetMonthlyReport('tenant-a', 'all', '2026-03')
    expect(report.byTruck.map(truck => truck.totals.income)).toEqual(['1.01', '1.01'])
    expect(report.totals.income).toBe('2.01')
    expect(queries.transactions).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-a', truckId: { in: ['truck-a', 'truck-b'] } }) }))
  })
  it('rejects an unowned selection without reading operational or financial rows', async () => {
    queries.transactions.mockClear(); queries.segments.mockClear()
    await expect(loadFleetMonthlyReport('tenant-a', 'other', '2026-03')).rejects.toThrow()
    expect(queries.transactions).not.toHaveBeenCalled()
    expect(queries.segments).not.toHaveBeenCalled()
  })
  it('filters tenant and selected truck, counts split days once and never reads wages', async () => {
    queries.countDays.mockResolvedValueOnce(1)
    queries.transactions.mockResolvedValue([{ id: 't', truckId: 'truck-a', type: 'INCOME', amount: 0.1, date: new Date(), description: 'Recorded', category: null }, { id: 'u', truckId: 'truck-a', type: 'INCOME', amount: 0.2, date: new Date(), description: 'Recorded', category: null }])
    const operation = { companyName: 'Exact Co', dailyPayDay: { id: 'day-1', worker: { name: 'Ana' } } }
    queries.segments.mockResolvedValueOnce([{ id: 's1', truckId: 'truck-a', workDate: new Date('2026-03-01'), share: 60, kilometers: null, incident: null, operation }, { id: 's2', truckId: 'truck-a', workDate: new Date('2026-03-01'), share: 40, kilometers: null, incident: null, operation }])
    const report = await loadFleetMonthlyReport('tenant-a', 'truck-a', '2026-03')
    expect(report.totals).toEqual({ income: '0.30', expense: '0.00' })
    expect(report.workerDays).toBe(1)
    expect(report.segments[0].operation.companyName).toBe('Exact Co')
    expect(queries.transactions).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'tenant-a', truckId: 'truck-a', type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: new Date('2026-02-28T23:00:00Z'), lt: new Date('2026-03-31T22:00:00Z') } } }))
    expect(queries.segments).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-a', truckId: 'truck-a', operation: { organizationId: 'tenant-a', dailyPayDay: { organizationId: 'tenant-a', worker: { organizationId: 'tenant-a' } } } }) }))
    expect(JSON.stringify(queries.segments.mock.lastCall)).not.toMatch(/salary|wage/i)
  })
})

describe('truck monthly period', () => {
  it('uses Madrid today and rejects invalid or repeated months', () => {
    expect(resolveReportMonth(undefined, new Date('2026-03-31T22:30:00Z'))).toBe('2026-04')
    expect(resolveReportMonth('2026-02')).toBe('2026-02')
    expect(() => resolveReportMonth('2026-13')).toThrow()
    expect(() => resolveReportMonth(['2026-01', '2026-02'])).toThrow()
  })
  it('preserves historical Madrid offset seconds at the 1900 boundary', () => {
    expect(madridMonthRange('1900-01').start.toISOString()).toBe('1900-01-01T00:14:44.000Z')
    expect(madridPeriodRange('1900-01', 'year').start.toISOString()).toBe('1900-01-01T00:14:44.000Z')
  })
  it('uses exclusive UTC boundaries across both DST changes', () => {
    expect(madridMonthRange('2026-03').start.toISOString()).toBe('2026-02-28T23:00:00.000Z')
    expect(madridMonthRange('2026-03').end.toISOString()).toBe('2026-03-31T22:00:00.000Z')
    expect(madridMonthRange('2026-10').end.toISOString()).toBe('2026-10-31T23:00:00.000Z')
  })
  it('scopes both reads to tenant, truck and distinct date representations', async () => {
    await loadTruckMonthlyReport('tenant-a', 'truck-b', '2026-03')
    expect(queries.transactions).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-a', truckId: 'truck-b', date: { gte: new Date('2026-02-28T23:00:00Z'), lt: new Date('2026-03-31T22:00:00Z') } }) }))
    expect(queries.segments).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-a', truckId: 'truck-b', workDate: { gte: new Date('2026-03-01T00:00:00Z'), lt: new Date('2026-04-01T00:00:00Z') }, operation: { organizationId: 'tenant-a', dailyPayDay: { organizationId: 'tenant-a', worker: { organizationId: 'tenant-a' } } } }) }))
  })
  it('preserves valid transaction filters only and wires month into the other GET form', () => {
    expect(sanitizeTransactionFilters('INCOME', 'asc')).toEqual({ type: 'INCOME', sort: 'asc' })
    expect(sanitizeTransactionFilters(['EXPENSE'], 'unexpected')).toEqual({ type: '', sort: 'desc' })
    const page = readFileSync('src/app/(app)/trucks/[id]/page.tsx', 'utf8')
    expect(page).toMatch(/<input[^>]+type="hidden"[^>]+name="month"[^>]+value=\{reportMonth\}/)
  })
  it('retains fractional cents in rows while rounding the aggregate once', () => {
    expect(recordedAmount(1.005)).toBe('1.005')
    expect(recordedAmount(1)).toBe('1.00')
    expect(recordedTotals([{ type: 'INCOME', amount: 1.005 }, { type: 'INCOME', amount: 1.005 }])).toEqual({ income: '2.01', expense: '0.00' })
  })
  it('sums floating stored amounts with exact decimal arithmetic', () => {
    expect(recordedTotals([{ type: 'INCOME', amount: 0.1 }, { type: 'INCOME', amount: 0.2 }, { type: 'EXPENSE', amount: 0.05 }])).toEqual({ income: '0.30', expense: '0.05' })
  })
})
