import { describe, expect, it, vi } from 'vitest'
import { TruckMileageService } from '@/services/truck-mileage.service'

describe('TruckMileageService', () => {
  it('includes linked workday mileage in the ordinary history and total', async () => {
    const row = { id: 'derived', truckId: 'truck-a', date: new Date('2026-05-10T00:00:00Z'), km: 42, notes: null, createdAt: new Date('2026-05-10T00:00:00Z'), sourceWorkerDaySegmentId: 'segment-a' }
    const repo = {
      findByTruck: vi.fn().mockResolvedValue([row]),
      getYearlyTotal: vi.fn().mockResolvedValue(42),
      getMonthlyTotal: vi.fn().mockResolvedValue(42),
    }
    const service = new TruckMileageService(repo as never)

    const result = await service.getMileageHistory('truck-a', 2026, 5)

    expect(result.totalKm).toBe(42)
    expect(result.monthlyKm).toBe(42)
    expect(result.records).toEqual([expect.objectContaining({ id: 'derived', km: 42, sourceWorkerDaySegmentId: 'segment-a' })])
  })

  it('does not allow manual creation to duplicate a workday-derived date', async () => {
    const repo = {
      findByTruckAndDate: vi.fn().mockResolvedValue({ sourceWorkerDaySegmentId: 'segment-a' }),
      create: vi.fn(),
    }
    const service = new TruckMileageService(repo as never)

    await expect(service.createMileage({ truckId: '11111111-1111-4111-8111-111111111111', date: new Date('2026-05-10'), km: 42, organizationId: 'tenant-a' }))
      .rejects.toMatchObject({ statusCode: 409, message: /jornada del trabajador/i })
    expect(repo.create).not.toHaveBeenCalled()
  })
})
