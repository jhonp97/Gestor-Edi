// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
const db = vi.hoisted(() => ({ worker: { findFirst: vi.fn() }, dailyPayDay: { findMany: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/auth-edge', () => ({ getUserFromRequest: vi.fn() }))
import { getUserFromRequest } from '@/lib/auth-edge'
import { GET } from '@/app/api/workers/[id]/daily-pay/range/route'
const invoke = (query = 'periodStart=2025-12-15&periodEnd=2026-01-14') => GET(new Request(`http://localhost/api/workers/w/daily-pay/range?${query}`), { params: Promise.resolve({ id: 'w' }) })
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getUserFromRequest).mockResolvedValue({ organizationId: 'org' } as never)
  db.worker.findFirst.mockResolvedValue({ id: 'w' })
  db.dailyPayDay.findMany.mockResolvedValue([
    { workDate: new Date('2025-12-15'), rateSnapshot: new Prisma.Decimal('0.10') },
    { workDate: new Date('2026-01-14'), rateSnapshot: new Prisma.Decimal('0.20') },
  ])
})
it('returns inclusive cross-year worked dates and exact snapshot sum without writes', async () => {
  const response = await invoke()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ workerId: 'w', periodStart: '2025-12-15', periodEnd: '2026-01-14', days: [
    { date: '2025-12-15', rateSnapshot: '0.10' }, { date: '2026-01-14', rateSnapshot: '0.20' },
  ], totals: { accrued: '0.30' } })
  expect(db.dailyPayDay.findMany).toHaveBeenCalledWith({ where: { workerId: 'w', organizationId: 'org', workDate: { gte: new Date('2025-12-15'), lte: new Date('2026-01-14') } }, orderBy: { workDate: 'asc' } })
})
it('supports a single included day and no-work range', async () => {
  db.dailyPayDay.findMany.mockResolvedValue([])
  const response = await invoke('periodStart=2026-02-01&periodEnd=2026-02-01')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ workerId: 'w', periodStart: '2026-02-01', periodEnd: '2026-02-01', days: [], totals: { accrued: '0.00' } })
})
it.each(['', 'periodStart=2026-02-30&periodEnd=2026-03-02', 'periodStart=2026-03-15&periodEnd=2026-03-14', 'periodStart=2026-03-15'])('rejects invalid intervals before database access: %s', async (query) => {
  const response = await invoke(query)
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: expect.any(String) })
  expect(db.worker.findFirst).not.toHaveBeenCalled()
  expect(db.dailyPayDay.findMany).not.toHaveBeenCalled()
})
it('denies missing organization and hides foreign workers', async () => {
  vi.mocked(getUserFromRequest).mockResolvedValue(null)
  expect((await invoke()).status).toBe(401)
  expect(db.worker.findFirst).not.toHaveBeenCalled()
  vi.mocked(getUserFromRequest).mockResolvedValue({ organizationId: 'org' } as never)
  db.worker.findFirst.mockResolvedValue(null)
  const response = await invoke()
  expect(response.status).toBe(404)
  expect(await response.json()).toEqual({ error: 'Trabajador no encontrado' })
  expect(db.worker.findFirst).toHaveBeenCalledWith({ where: { id: 'w', organizationId: 'org' } })
  expect(db.dailyPayDay.findMany).not.toHaveBeenCalled()
})
