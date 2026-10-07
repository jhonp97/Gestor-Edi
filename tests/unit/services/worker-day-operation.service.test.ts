import { describe, expect, it, vi } from 'vitest'
import { WorkerDayOperationService } from '@/services/worker-day-operation.service'
import { ManualMileageConflictError } from '@/repositories/worker-day-operation.repository'

const date = '2026-09-03'
const input = { companyName: 'Carrier', segments: [{ truckId: '11111111-1111-4111-8111-111111111111', share: 100 }] }

describe('operational day service', () => {
  it('rejects a paid month without changing its legacy day', async () => {
    const repository = { runSerializable: vi.fn(async callback => callback({})), acquireMonthControl: vi.fn(async () => ({ status: 'PAID' })), findDay: vi.fn(), save: vi.fn() }
    const service = new WorkerDayOperationService('tenant', repository as never)
    await expect(service.put('worker', date, input)).rejects.toMatchObject({ status: 409 })
    expect(repository.save).not.toHaveBeenCalled()
  })
  it('surfaces a manual mileage conflict without retrying the operation', async () => {
    const conflict = new ManualMileageConflictError('manual mileage conflict')
    const repository = {
      runSerializable: vi.fn(async callback => callback({})),
      acquireMonthControl: vi.fn(async () => ({ status: 'PENDING' })),
      ownsTrucks: vi.fn(async () => true),
      save: vi.fn().mockRejectedValue(conflict),
    }
    const service = new WorkerDayOperationService('tenant', repository as never)
    await expect(service.put('worker', date, input)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/kilometraje manual/i) })
    expect(repository.save).toHaveBeenCalledTimes(1)
  })

  it('rejects a missing tenant worker', async () => {
    const repository = { runSerializable: vi.fn(async callback => callback({})), acquireMonthControl: vi.fn(async () => null), save: vi.fn() }
    const service = new WorkerDayOperationService('tenant', repository as never)
    await expect(service.put('worker', date, input)).rejects.toMatchObject({ status: 404 })
    expect(repository.save).not.toHaveBeenCalled()
  })
})
