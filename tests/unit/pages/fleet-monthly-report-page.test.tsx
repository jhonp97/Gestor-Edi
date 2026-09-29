import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ session: vi.fn(), trucks: vi.fn(), transactions: vi.fn(), segments: vi.fn(), notFound: vi.fn(() => { throw new Error('NOT_FOUND') }), redirect: vi.fn(() => { throw new Error('REDIRECT') }) }))
vi.mock('@/lib/session', () => ({ getSessionUniversal: mocks.session }))
vi.mock('next/navigation', () => ({ notFound: mocks.notFound, redirect: mocks.redirect }))
vi.mock('@/lib/prisma', () => ({ prisma: { truck: { findMany: mocks.trucks }, transaction: { findMany: mocks.transactions }, workerDayTruckSegment: { findMany: mocks.segments } } }))
import Page from '@/app/(app)/trucks/report/page'

const page = (params: { month?: string | string[]; truck?: string | string[]; period?: string | string[] } = {}) => Page({ searchParams: Promise.resolve(params) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ user: { organizationId: 'tenant-a' } })
  mocks.trucks.mockResolvedValue([{ id: 'owned', plate: 'AAA' }])
  mocks.transactions.mockResolvedValue([])
  mocks.segments.mockResolvedValue([])
})

it('redirects unauthenticated requests before any database read', async () => {
  mocks.session.mockResolvedValue(null)
  await expect(page()).rejects.toThrow('REDIRECT')
  expect(mocks.redirect).toHaveBeenCalledWith('/login')
  expect(mocks.trucks).not.toHaveBeenCalled()
})

it('rejects invalid month and repeated/invalid truck selections before database reads', async () => {
  for (const params of [{ month: '2026-13' }, { truck: ['owned', 'other'] }, { truck: 'bad/id' }, { period: 'week' }, { period: ['month', 'year'] }]) {
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

it('propagates database errors instead of misreporting missing selection', async () => {
  const failure = new Error('database unavailable')
  mocks.trucks.mockRejectedValueOnce(failure)
  await expect(page({ month: '2026-03' })).rejects.toBe(failure)
  expect(mocks.notFound).not.toHaveBeenCalled()
})
