import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const queries = vi.hoisted(() => ({ transactions: vi.fn().mockResolvedValue([]), segments: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/prisma', () => ({ prisma: { transaction: { findMany: queries.transactions }, workerDayTruckSegment: { findMany: queries.segments } } }))
import { madridMonthRange, resolveReportMonth, recordedTotals, loadTruckMonthlyReport, recordedAmount, sanitizeTransactionFilters } from '@/lib/truck-monthly-report'

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
