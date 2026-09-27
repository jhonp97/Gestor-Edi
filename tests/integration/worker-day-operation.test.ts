// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { Prisma, PrismaClient } from '@prisma/client'
import { WorkerDayOperationRepository } from '@/repositories/worker-day-operation.repository'
import { WorkerDayOperationService } from '@/services/worker-day-operation.service'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const url = process.env.TEST_DATABASE_URL
const db = url ? describe : describe.skip

db('worker day operations on disposable PostgreSQL', () => {
  let client: PrismaClient
  let a: string, b: string, first: string, second: string, foreign: string, truck: string, spare: string, foreignTruck: string
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const day = '2026-03-15'
  const input = (truckId: string) => ({ companyName: 'Carrier', segments: [{ truckId, share: 100 }] })
  const service = (org: string) => new WorkerDayOperationService(org, new WorkerDayOperationRepository(org, client))
  const worker = (org: string, suffix: string) => client.worker.create({ data: {
    name: suffix, dni: `${stamp}-${suffix}`, position: 'driver', baseSalary: 100,
    dailyRate: new Prisma.Decimal('120.50'), startDate: new Date('2026-01-01'), organizationId: org,
  } })
  const vehicle = (org: string, suffix: string) => client.truck.create({ data: {
    plate: `${stamp}-${suffix}`, brand: 'Test', model: 'Test', year: 2020, organizationId: org,
  } })
  beforeAll(async () => {
    client = new PrismaClient({ datasources: { db: { url } } })
    await client.$connect()
    const [orgA, orgB] = await Promise.all(['a', 'b'].map(s => client.organization.create({ data: { name: `${stamp}-${s}` } })))
    a = orgA.id; b = orgB.id
    const [w1, w2, wf, t1, t2, tf] = await Promise.all([
      worker(a, 'first'), worker(a, 'second'), worker(b, 'foreign'),
      vehicle(a, 'truck'), vehicle(a, 'spare'), vehicle(b, 'foreign-truck'),
    ])
    first = w1.id; second = w2.id; foreign = wf.id
    truck = t1.id; spare = t2.id; foreignTruck = tf.id
  })
  afterAll(async () => {
    if (client) {
      if (a && b) {
        await client.organization.deleteMany({ where: { id: { in: [a, b] } } })
      }
      await client.$disconnect()
    }
  })
  it('rejects competing workers for the same truck and whole civil day', async () => {
    const outcomes = await Promise.allSettled([service(a).put(first, day, input(truck)), service(a).put(second, day, input(truck))])
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter(x => x.status === 'rejected')).toHaveLength(1)
    expect((outcomes.find(x => x.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ status: 409 })
    expect(await client.workerDayTruckSegment.count({ where: { truckId: truck, workDate: new Date(`${day}T00:00:00Z`) } })).toBe(1)
  })
  it('returns the broken primary first after segments were inserted in reverse order', async () => {
    const date = '2026-03-17'
    await service(a).put(first, date, { companyName: 'Carrier', segments: [
      { truckId: truck, share: 50, incident: 'Breakdown' }, { truckId: spare, share: 50 },
    ] })
    const operation = await client.workerDayOperation.findFirstOrThrow({ where: { organizationId: a, dailyPayDay: { workerId: first, workDate: new Date(`${date}T00:00:00Z`) } } })
    await client.workerDayTruckSegment.deleteMany({ where: { operationId: operation.id } })
    for (const segment of [
      { truckId: spare, position: 2, share: 50, incident: null },
      { truckId: truck, position: 1, share: 50, incident: 'Breakdown' },
    ]) {
      await client.workerDayTruckSegment.create({ data: { ...segment, operationId: operation.id, organizationId: a, workDate: new Date(`${date}T00:00:00Z`) } })
    }
    expect((await service(a).get(first, date))?.operation?.segments.map(s => s.truckId)).toEqual([truck, spare])
  })
  it('preserves a legacy day without inventing a company or truck', async () => {
    const date = '2026-03-16'
    await client.dailyPayDay.create({ data: { workerId: second, organizationId: a, workDate: new Date(`${date}T00:00:00Z`), rateSnapshot: new Prisma.Decimal('75.25') } })
    expect(await service(a).get(second, date)).toMatchObject({ rateSnapshot: '75.25', operation: null })
    expect(await service(a).put(second, date, input(spare))).toMatchObject({ rateSnapshot: '75.25' })
  })
  it('rejects edits to a PAID month without modifying the existing snapshot', async () => {
    const paidDay = '2026-05-15'
    await service(a).put(first, paidDay, input(truck))
    await client.dailyPayMonthControl.updateMany({ where: { workerId: first, organizationId: a, periodStart: new Date('2026-05-01T00:00:00Z') }, data: { status: 'PAID', paidAt: new Date() } })
    await expect(service(a).put(first, paidDay, input(spare))).rejects.toMatchObject({ status: 409 })
    expect(await service(a).get(first, paidDay)).toMatchObject({ rateSnapshot: '120.50', operation: { segments: [{ truckId: truck }] } })
  })
  it('enforces tenant ownership for workers and trucks', async () => {
    await expect(service(a).get(foreign, day)).rejects.toMatchObject({ status: 404 })
    await expect(service(a).put(foreign, day, input(spare))).rejects.toMatchObject({ status: 404 })
    const freeDay = '2026-04-01'
    await expect(service(a).put(second, freeDay, input(foreignTruck))).rejects.toMatchObject({ status: 404 })
    expect(await client.dailyPayDay.count({ where: { organizationId: a, workerId: second, workDate: new Date(`${freeDay}T00:00:00Z`) } })).toBe(0)
    expect(await client.workerDayOperation.count({ where: { organizationId: a, dailyPayDay: { workerId: second, workDate: new Date(`${freeDay}T00:00:00Z`) } } })).toBe(0)
    expect(await client.workerDayTruckSegment.count({ where: { truckId: foreignTruck, workDate: new Date(`${freeDay}T00:00:00Z`) } })).toBe(0)
    expect(await client.workerDayOperation.count({ where: { organizationId: b } })).toBe(0)
  })
})
