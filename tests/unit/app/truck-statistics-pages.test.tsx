import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
const mocks = vi.hoisted(() => ({ transactions: vi.fn().mockResolvedValue([]), trucks: vi.fn().mockResolvedValue([]), truck: vi.fn().mockResolvedValue({ id: 'truck', transactions: [], mileages: [], workers: [], brand: 'Brand', model: 'Model', year: 2026, status: 'ACTIVE', plate: 'ABC' }), workers: vi.fn().mockResolvedValue([]), session: vi.fn().mockResolvedValue({ user: { organizationId: 'org' } }) }))
vi.mock('@/lib/prisma', () => ({ prisma: { truck: { findMany: mocks.trucks, findFirst: mocks.truck }, worker: { findMany: mocks.workers }, transaction: { findMany: mocks.transactions } } }))
vi.mock('@/lib/session', () => ({ getSessionUniversal: mocks.session }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: () => { throw new Error('notFound') } }))
vi.mock('@/components/trucks/truck-form', () => ({ TruckForm: () => null }))
vi.mock('@/components/trucks/truck-statistics-filter', () => ({ TruckStatisticsFilter: () => null }))
vi.mock('@/lib/truck-monthly-report', () => ({ InvalidReportCursorError: class extends Error {}, loadTruckMonthlyReport: vi.fn().mockResolvedValue({}), resolveReportMonth: () => '2026-03', sanitizeTransactionFilters: (type: string, sort: string) => ({ type, sort }), validateReportCursors: vi.fn() }))
vi.mock('@/components/trucks/truck-monthly-report', () => ({ TruckMonthlyReport: () => null }))
vi.mock('@/components/trucks/truck-edit-dialog', () => ({ TruckEditDialog: () => null }))
vi.mock('@/components/trucks/truck-delete-button', () => ({ TruckDeleteButton: () => null }))
vi.mock('@/components/trucks/worker-day-operation-entry', () => ({ WorkerDayOperationEntry: () => null }))
vi.mock('@/components/trucks', () => ({ TruckMileageSummary: () => null, TruckMileageHistory: () => null }))
vi.mock('@/components/transactions/transaction-form', () => ({ TransactionForm: () => null }))
import TrucksPage from '@/app/(app)/trucks/page'
import TruckDetailPage from '@/app/(app)/trucks/[id]/page'
afterEach(() => vi.useRealTimers())
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-03-15T12:00:00Z')) })
it.each([
  [{}, { gte: new Date('2026-02-28T23:00:00Z'), lt: new Date('2026-03-31T22:00:00Z') }],
  [{ statsPeriod: 'month', statsMonth: '2026-02' }, { gte: new Date('2026-01-31T23:00:00Z'), lt: new Date('2026-02-28T23:00:00Z') }],
  [{ statsPeriod: 'all' }, undefined],
  [{ statsPeriod: 'range', statsFrom: '2026-03-29', statsTo: '2026-03-29' }, { gte: new Date('2026-03-28T23:00:00Z'), lt: new Date('2026-03-29T22:00:00Z') }],
])('scopes card statistics to selected dates %j', async (query, date) => {
  await TrucksPage({ searchParams: Promise.resolve(query) } as never)
  expect(mocks.transactions).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org', ...(date ? { date } : {}) } }))
  await TruckDetailPage({ params: Promise.resolve({ id: 'truck' }), searchParams: Promise.resolve({ ...query, type: 'EXPENSE', sort: 'asc' }) })
  expect(mocks.transactions).toHaveBeenLastCalledWith(expect.objectContaining({ where: { organizationId: 'org', truckId: 'truck', ...(date ? { date } : {}) } }))
  expect(mocks.truck).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'truck', organizationId: 'org' }, include: expect.objectContaining({ transactions: { where: { type: 'EXPENSE' }, orderBy: { date: 'asc' } } }) }))
})
it.each([
  [{}, 100, 30],
  [{ statsPeriod: 'month', statsMonth: '2026-02' }, 50, 0],
  [{ statsPeriod: 'all' }, 150, 70],
  [{ statsPeriod: 'range', statsFrom: '2026-03-29', statsTo: '2026-03-29' }, 0, 30],
])('renders matching income, expense and balance on cards/detail for %j', async (query, income, expense) => {
  const truck = { id: 'truck', brand: 'Brand', model: 'Model', year: 2026, status: 'ACTIVE', plate: 'ABC' }
  const rows = [
    { organizationId: 'org', truckId: 'truck', type: 'INCOME', amount: 100, date: new Date('2026-03-15T12:00:00Z') },
    { organizationId: 'org', truckId: 'truck', type: 'EXPENSE', amount: 30, date: new Date('2026-03-29T21:59:59.999Z') },
    { organizationId: 'org', truckId: 'truck', type: 'INCOME', amount: 50, date: new Date('2026-02-15T12:00:00Z') },
    { organizationId: 'org', truckId: 'truck', type: 'EXPENSE', amount: 40, date: new Date('2026-04-01T12:00:00Z') },
    { organizationId: 'org', truckId: 'other-truck', type: 'INCOME', amount: 900, date: new Date('2026-03-15T12:00:00Z') },
    { organizationId: 'other-org', truckId: 'truck', type: 'INCOME', amount: 1000000, date: new Date('2026-03-15T12:00:00Z') },
  ]
  const selectRows = ({ where }: { where: { organizationId: string; truckId?: string; date?: { gte: Date; lt: Date } } }) => Promise.resolve(rows.filter(row =>
    row.organizationId === where.organizationId && (!where.truckId || row.truckId === where.truckId) &&
    (!where.date || (row.date >= where.date.gte && row.date < where.date.lt))
  ))
  mocks.trucks.mockResolvedValueOnce([truck])
  mocks.transactions.mockImplementationOnce(selectRows).mockImplementationOnce(selectRows)
  const cards = renderToStaticMarkup(await TrucksPage({ searchParams: Promise.resolve(query) }))
  const detail = renderToStaticMarkup(await TruckDetailPage({ params: Promise.resolve({ id: 'truck' }), searchParams: Promise.resolve({ ...query, type: 'EXPENSE', sort: 'asc' }) }))
  for (const amount of [income, expense, income - expense]) {
    expect(cards).toContain(`$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
    expect(detail).toContain(`€${amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`)
  }
  expect(cards).not.toContain('1.000.000')
  expect(detail).not.toContain('1.000.000')
  expect(cards).not.toContain('$900,00')
  expect(detail).not.toContain('€900,00')
})
it('rejects malformed statistics before database queries after authenticating', async () => {
  const searchParams = Promise.resolve({ statsPeriod: ['all', 'all'] })
  await expect(TrucksPage({ searchParams })).rejects.toThrow('notFound')
  await expect(TruckDetailPage({ params: Promise.resolve({ id: 'truck' }), searchParams })).rejects.toThrow('notFound')
  expect(mocks.session).toHaveBeenCalledTimes(2)
  expect(mocks.truck).not.toHaveBeenCalled()
  expect(mocks.transactions).not.toHaveBeenCalled()
})
