import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const queries = vi.hoisted(() => ({ transactions: vi.fn().mockResolvedValue([]), segments: vi.fn().mockResolvedValue([]), trucks: vi.fn().mockResolvedValue([{ id: 'truck-a', plate: 'AAA' }, { id: 'truck-b', plate: 'BBB' }]) }))
vi.mock('@/lib/prisma', () => ({ prisma: { transaction: { findMany: queries.transactions }, workerDayTruckSegment: { findMany: queries.segments }, truck: { findMany: queries.trucks } } }))
import { madridMonthRange, resolveReportMonth, recordedTotals, loadTruckMonthlyReport, loadFleetMonthlyReport, recordedAmount, sanitizeTransactionFilters } from '@/lib/truck-monthly-report'

describe('fleet monthly report', () => {
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
    queries.transactions.mockResolvedValueOnce([
      { truckId: 'truck-a', type: 'INCOME', amount: 1.005 },
      { truckId: 'truck-b', type: 'INCOME', amount: 1.005 },
    ])
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
    queries.transactions.mockResolvedValueOnce([{ id: 't', truckId: 'truck-a', type: 'INCOME', amount: 0.1, date: new Date(), description: 'Recorded', category: null }, { id: 'u', truckId: 'truck-a', type: 'INCOME', amount: 0.2, date: new Date(), description: 'Recorded', category: null }])
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
