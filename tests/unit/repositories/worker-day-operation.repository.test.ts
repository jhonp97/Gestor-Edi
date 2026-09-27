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
  it('requires every truck to belong to the tenant', async () => {
    const count = vi.fn().mockResolvedValue(1)
    const repo = new WorkerDayOperationRepository('tenant-a', {} as never)
    expect(await repo.ownsTrucks(['one', 'two'], { truck: { count } } as never)).toBe(false)
    expect(count).toHaveBeenCalledWith({ where: { id: { in: ['one', 'two'] }, organizationId: 'tenant-a' } })
  })
})
