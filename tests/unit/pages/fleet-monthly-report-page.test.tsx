import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ session: vi.fn(), trucks: vi.fn(), transactions: vi.fn(), segments: vi.fn(), countDays: vi.fn(), transactionAnchor: vi.fn(), segmentAnchor: vi.fn(), notFound: vi.fn(() => { throw new Error('NOT_FOUND') }), redirect: vi.fn(() => { throw new Error('REDIRECT') }) }))
vi.mock('@/lib/session', () => ({ getSessionUniversal: mocks.session }))
vi.mock('next/navigation', () => ({ notFound: mocks.notFound, redirect: mocks.redirect }))
vi.mock('@/lib/prisma', () => ({ prisma: { truck: { findMany: mocks.trucks }, dailyPayDay: { count: mocks.countDays }, transaction: { findMany: mocks.transactions, findFirst: mocks.transactionAnchor }, workerDayTruckSegment: { findMany: mocks.segments, findFirst: mocks.segmentAnchor } } }))
import Page from '@/app/(app)/trucks/report/page'

const page = (params: { month?: string | string[]; truck?: string | string[]; period?: string | string[]; transactionsCursor?: string | string[]; segmentsCursor?: string | string[] } = {}) => Page({ searchParams: Promise.resolve(params) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ user: { organizationId: 'tenant-a' } })
  mocks.trucks.mockResolvedValue([{ id: 'owned', plate: 'AAA' }])
  mocks.transactions.mockResolvedValue([])
  mocks.segments.mockResolvedValue([])
  mocks.countDays.mockResolvedValue(0)
  mocks.transactionAnchor.mockResolvedValue(null)
  mocks.segmentAnchor.mockResolvedValue(null)
})

it('redirects unauthenticated requests before any database read', async () => {
  mocks.session.mockResolvedValue(null)
  await expect(page()).rejects.toThrow('REDIRECT')
  expect(mocks.redirect).toHaveBeenCalledWith('/login')
  expect(mocks.trucks).not.toHaveBeenCalled()
})

it('rejects invalid month and repeated/invalid truck selections before database reads', async () => {
  for (const params of [{ month: '2026-13' }, { truck: ['owned', 'other'] }, { truck: 'bad/id' }, { period: 'week' }, { period: ['month', 'year'] }, { transactionsCursor: ['next:a', 'next:b'] }, { segmentsCursor: 'bad' }]) {
    await expect(page(params)).rejects.toThrow('NOT_FOUND')
  }
  expect(mocks.trucks).not.toHaveBeenCalled()
})

it('rejects a truck outside the tenant without reading report rows', async () => {
  await expect(page({ truck: 'other', month: '2026-03' })).rejects.toThrow('NOT_FOUND')
  expect(mocks.trucks).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'tenant-a' } }))
  expect(mocks.transactions).not.toHaveBeenCalled()
  expect(mocks.segments).not.toHaveBeenCalled()
})

it('strictly rejects cursor anchors outside the selected tenant, period or truck', async () => {
  await expect(page({ truck: 'owned', month: '2026-03', transactionsCursor: 'next:foreign' })).rejects.toThrow('NOT_FOUND')
  expect(mocks.transactionAnchor).toHaveBeenCalledWith({ where: { organizationId: 'tenant-a', truckId: 'owned', type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: new Date('2026-02-28T23:00:00Z'), lt: new Date('2026-03-31T22:00:00Z') }, id: 'foreign' }, select: { id: true } })
  expect(mocks.transactions).not.toHaveBeenCalled()
  await expect(page({ month: '2026-03', segmentsCursor: 'prev:foreign' })).rejects.toThrow('NOT_FOUND')
  expect(mocks.segmentAnchor).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-a', id: 'foreign', workDate: { gte: new Date('2026-03-01'), lt: new Date('2026-04-01') } }) }))
})

it('propagates database errors instead of misreporting missing selection', async () => {
  const failure = new Error('database unavailable')
  mocks.trucks.mockRejectedValueOnce(failure)
  await expect(page({ month: '2026-03' })).rejects.toBe(failure)
  expect(mocks.notFound).not.toHaveBeenCalled()
})
