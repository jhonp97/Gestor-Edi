import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ truckMileage: { findFirst: vi.fn(), delete: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { LinkedMileageDeletionError, TruckMileageRepository } from '@/repositories/truck-mileage.repository'

describe('truck mileage repository', () => {
  beforeEach(() => {
    db.truckMileage.findFirst.mockReset()
    db.truckMileage.delete.mockReset()
  })

  it('refuses to delete mileage linked to a worker-day segment', async () => {
    db.truckMileage.findFirst.mockResolvedValue({ id: 'derived', sourceWorkerDaySegmentId: 'segment-1' })
    const repo = new TruckMileageRepository('tenant-a')

    await expect(repo.delete('derived')).rejects.toBeInstanceOf(LinkedMileageDeletionError)
    expect(db.truckMileage.findFirst).toHaveBeenCalledWith({
      where: { id: 'derived', organizationId: 'tenant-a' },
      select: { id: true, sourceWorkerDaySegmentId: true },
    })
    expect(db.truckMileage.delete).not.toHaveBeenCalled()
  })

  it('continues to delete manually entered mileage within the tenant', async () => {
    db.truckMileage.findFirst.mockResolvedValue({ id: 'manual', sourceWorkerDaySegmentId: null })
    const repo = new TruckMileageRepository('tenant-a')

    await repo.delete('manual')

    expect(db.truckMileage.delete).toHaveBeenCalledWith({ where: { id: 'manual' } })
  })
})
