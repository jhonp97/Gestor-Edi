import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  truckFindFirst: vi.fn(),
  mileageFindFirst: vi.fn(),
  mileageDelete: vi.fn(),
}))
vi.mock('@/lib/auth-edge', () => ({ getUserFromRequest: mocks.getUserFromRequest }))
vi.mock('@/lib/prisma', () => ({ prisma: { truck: { findFirst: mocks.truckFindFirst }, truckMileage: { findFirst: mocks.mileageFindFirst, delete: mocks.mileageDelete } } }))

import { DELETE } from '@/app/api/trucks/[id]/mileage/[mileageId]/route'

const context = { params: Promise.resolve({ id: 'truck-a', mileageId: 'mileage-a' }) }

describe('truck mileage route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUserFromRequest.mockResolvedValue({ organizationId: 'tenant-a' })
    mocks.truckFindFirst.mockResolvedValue({ id: 'truck-a' })
    mocks.mileageFindFirst.mockResolvedValue({ id: 'mileage-a', sourceWorkerDaySegmentId: 'segment-a' })
  })

  it('refuses deleting linked worker-day mileage without altering its source', async () => {
    const response = await DELETE(new Request('http://localhost/api/trucks/truck-a/mileage/mileage-a', { method: 'DELETE' }), context)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Este kilometraje se actualiza desde la jornada del trabajador' })
    expect(mocks.mileageFindFirst).toHaveBeenCalledWith({ where: { id: 'mileage-a', truckId: 'truck-a', organizationId: 'tenant-a' } })
    expect(mocks.mileageDelete).not.toHaveBeenCalled()
  })
})
