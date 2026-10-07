import { describe, expect, it, vi } from 'vitest'
import { WorkerDayOperationRepository } from '@/repositories/worker-day-operation.repository'

const date = '2026-09-03'

describe('tenant-scoped operational day repository', () => {
  it('reads only a day belonging to the requested worker and organization', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const repo = new WorkerDayOperationRepository('tenant-a', {} as never)
    await repo.findDay('worker-a', date, { dailyPayDay: { findFirst } } as never)
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      workerId: 'worker-a', organizationId: 'tenant-a', workDate: new Date('2026-09-03T00:00:00.000Z'),
    } }))
  })
  it('reads the primary before the replacement even when storage inserts in reverse order', async () => {
    const segments = [
      { truckId: 'replacement', position: 2, share: 50, kilometers: null, incident: null },
      { truckId: 'primary', position: 1, share: 50, kilometers: null, incident: 'Breakdown' },
    ]
    const findFirst = vi.fn().mockImplementation(async ({ include }) => ({
      workDate: new Date('2026-09-03T00:00:00Z'), rateSnapshot: '120.00',
      operation: { companyName: 'Carrier', segments: include.operation.include.segments.orderBy?.position === 'asc'
        ? [...segments].sort((a, b) => a.position - b.position) : segments },
    }))
    const repo = new WorkerDayOperationRepository('tenant-a', {} as never)
    const result = await repo.findDay('worker-a', date, { dailyPayDay: { findFirst } } as never)
    expect(WorkerDayOperationRepository.serialize(result!).operation?.segments.map(s => s.truckId)).toEqual(['primary', 'replacement'])
  })
  it('creates one linked mileage row per kilometer-bearing truck segment in the same transaction', async () => {
    const existingDay = { id: 'day', workDate: new Date('2026-09-03T00:00:00Z'), operation: { id: 'operation' } }
    const savedDay = { ...existingDay, operation: { id: 'operation', companyName: 'Carrier', segments: [] } }
    const findDay = vi.fn().mockResolvedValueOnce(existingDay).mockResolvedValueOnce(savedDay)
    const deleteSegments = vi.fn().mockResolvedValue({ count: 1 })
    let segmentIndex = 0
    const createSegment = vi.fn(async ({ data }) => ({ id: `segment-${++segmentIndex}`, ...data }))
    const findManualMileage = vi.fn().mockResolvedValue(null)
    const createMileage = vi.fn().mockResolvedValue({})
    const tx = {
      dailyPayDay: { findFirst: findDay },
      workerDayOperation: { update: vi.fn().mockResolvedValue({ id: 'operation' }) },
      workerDayTruckSegment: { deleteMany: deleteSegments, create: createSegment },
      truckMileage: { findFirst: findManualMileage, create: createMileage },
    }
    const repo = new WorkerDayOperationRepository('tenant-a', {} as never)

    await repo.save('worker-a', date, { companyName: 'Carrier', segments: [
      { truckId: 'truck-a', share: 60, kilometers: 12.34, incident: 'Breakdown' },
      { truckId: 'truck-b', share: 40, kilometers: 8.25 },
    ] }, tx as never)

    expect(deleteSegments.mock.invocationCallOrder[0]).toBeLessThan(createSegment.mock.invocationCallOrder[0])
    expect(findManualMileage).toHaveBeenCalledTimes(2)
    expect(findManualMileage).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-a', truckId: 'truck-a', sourceWorkerDaySegmentId: null }) }))
    expect(createMileage).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ truckId: 'truck-a', organizationId: 'tenant-a', km: 12.34, sourceWorkerDaySegmentId: 'segment-1' }) })
    expect(createMileage).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ truckId: 'truck-b', organizationId: 'tenant-a', km: 8.25, sourceWorkerDaySegmentId: 'segment-2' }) })
  })

  it('does not create mileage for a missing kilometer value but preserves explicit zero', async () => {
    const existingDay = { id: 'day', workDate: new Date('2026-09-03T00:00:00Z'), operation: { id: 'operation' } }
    const savedDay = { ...existingDay, operation: { id: 'operation', companyName: 'Carrier', segments: [] } }
    const run = async (kilometers: number | undefined) => {
      const createMileage = vi.fn().mockResolvedValue({})
      const tx = {
        dailyPayDay: { findFirst: vi.fn().mockResolvedValueOnce(existingDay).mockResolvedValueOnce(savedDay) },
        workerDayOperation: { update: vi.fn().mockResolvedValue({ id: 'operation' }) },
        workerDayTruckSegment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'segment', ...data, kilometers: data.kilometers ?? null })) },
        truckMileage: { findFirst: vi.fn().mockResolvedValue(null), create: createMileage },
      }
      const repo = new WorkerDayOperationRepository('tenant-a', {} as never)
      await repo.save('worker-a', date, { companyName: 'Carrier', segments: [{ truckId: 'truck-a', share: 100, ...(kilometers === undefined ? {} : { kilometers }) }] }, tx as never)
      return createMileage
    }

    expect(await run(undefined)).not.toHaveBeenCalled()
    expect(await run(0)).toHaveBeenCalledWith({ data: expect.objectContaining({ km: 0, sourceWorkerDaySegmentId: 'segment' }) })
  })

  it('rejects manual mileage before replacing any operational segments', async () => {
    const existingDay = { id: 'day', workDate: new Date('2026-09-03T00:00:00Z'), operation: { id: 'operation' } }
    const deleteSegments = vi.fn()
    const updateOperation = vi.fn()
    const tx = {
      dailyPayDay: { findFirst: vi.fn().mockResolvedValue(existingDay) },
      workerDayOperation: { update: updateOperation },
      workerDayTruckSegment: { deleteMany: deleteSegments },
      truckMileage: { findFirst: vi.fn().mockResolvedValue({ id: 'manual-mileage', sourceWorkerDaySegmentId: null }) },
    }
    const repo = new WorkerDayOperationRepository('tenant-a', {} as never)

    await expect(repo.save('worker-a', date, { companyName: 'Carrier', segments: [{ truckId: 'truck-a', share: 100, kilometers: 12 }] }, tx as never))
      .rejects.toMatchObject({ code: 'MANUAL_MILEAGE_CONFLICT' })
    expect(updateOperation).not.toHaveBeenCalled()
    expect(deleteSegments).not.toHaveBeenCalled()
  })

  it('requires every truck to belong to the tenant', async () => {
    const count = vi.fn().mockResolvedValue(1)
    const repo = new WorkerDayOperationRepository('tenant-a', {} as never)
    expect(await repo.ownsTrucks(['one', 'two'], { truck: { count } } as never)).toBe(false)
    expect(count).toHaveBeenCalledWith({ where: { id: { in: ['one', 'two'] }, organizationId: 'tenant-a' } })
  })
})
