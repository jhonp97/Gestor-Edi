// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Prisma, PrismaClient } from '@prisma/client'

const injected = vi.hoisted(() => ({ client: null as PrismaClient | null, organizationId: '' }))
vi.mock('@/lib/prisma', () => ({ get prisma() { return injected.client } }))
vi.mock('@/lib/auth-edge', () => ({ getUserFromRequest: async () => ({ organizationId: injected.organizationId }) }))

import { DELETE } from '@/app/api/workers/[id]/daily-pay/days/[date]/route'
import { WorkerDayOperationService } from '@/services/worker-day-operation.service'
import { WorkerDayOperationRepository } from '@/repositories/worker-day-operation.repository'

const url = process.env.TEST_DATABASE_URL
const database = url ? describe : describe.skip

database('authenticated worker day DELETE on disposable PostgreSQL', () => {
  let client: PrismaClient
  let organizationId: string
  let workerId: string
  let truckId: string
  const stamp = `delete-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const date = (day: string) => new Date(`${day}T00:00:00Z`)
  const remove = (day: string) => DELETE(new Request('http://localhost/api/workers/day', { method: 'DELETE' }), {
    params: Promise.resolve({ id: workerId, date: day }),
  })

  beforeAll(async () => {
    client = new PrismaClient({ datasources: { db: { url } } })
    injected.client = client
    await client.$connect()
    const org = await client.organization.create({ data: { name: stamp } })
    organizationId = org.id
    injected.organizationId = organizationId
    const worker = await client.worker.create({ data: {
      name: 'Test Driver', dni: stamp, position: 'driver', baseSalary: 100,
      dailyRate: new Prisma.Decimal('120.50'), startDate: date('2026-01-01'), organizationId,
    } })
    workerId = worker.id
    const truck = await client.truck.create({ data: {
      plate: stamp, brand: 'Test', model: 'Test', year: 2020, organizationId,
    } })
    truckId = truck.id
  })

  afterAll(async () => {
    if (client) {
      if (organizationId) await client.organization.delete({ where: { id: organizationId } })
      await client.$disconnect()
    }
    injected.client = null
  })

  it('returns 409 for an operational day without deleting its day, operation or segments or creating a month control', async () => {
    const day = '2026-06-12'
    const service = new WorkerDayOperationService(organizationId, new WorkerDayOperationRepository(organizationId, client))
    await service.put(workerId, day, { companyName: 'Test Carrier', segments: [{ truckId, share: 100 }] })
    // Remove the existing pending control to detect a control created solely by DELETE.
    await client.dailyPayMonthControl.deleteMany({ where: { organizationId, workerId, periodStart: date('2026-06-01') } })
    expect((await remove(day)).status).toBe(409)
    const saved = await client.dailyPayDay.findFirst({ where: { organizationId, workerId, workDate: date(day) }, include: { operation: { include: { segments: true } } } })
    expect(saved?.operation?.segments).toHaveLength(1)
    expect(saved?.operation?.segments[0].truckId).toBe(truckId)
    expect(await client.dailyPayMonthControl.count({ where: { organizationId, workerId, periodStart: date('2026-06-01') } })).toBe(0)
  })

  it('returns 204 and removes a legacy day', async () => {
    const day = '2026-07-12'
    await client.dailyPayDay.create({ data: { organizationId, workerId, workDate: date(day), rateSnapshot: new Prisma.Decimal('120.50') } })
    expect((await remove(day)).status).toBe(204)
    expect(await client.dailyPayDay.count({ where: { organizationId, workerId, workDate: date(day) } })).toBe(0)
  })

  it('returns 409 and retains a PAID day', async () => {
    const day = '2026-08-12'
    await client.dailyPayDay.create({ data: { organizationId, workerId, workDate: date(day), rateSnapshot: new Prisma.Decimal('120.50') } })
    await client.dailyPayMonthControl.create({ data: { organizationId, workerId, periodStart: date('2026-08-01'), status: 'PAID', paidAt: new Date() } })
    expect((await remove(day)).status).toBe(409)
    expect(await client.dailyPayDay.count({ where: { organizationId, workerId, workDate: date(day) } })).toBe(1)
  })
})
