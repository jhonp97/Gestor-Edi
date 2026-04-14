import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma module — vi.mock is hoisted, so factory must be self-contained
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    worker: { count: vi.fn() },
    truck: { count: vi.fn() },
    transaction: { count: vi.fn() },
  },
}))

import { PlanService } from '@/services/plan.service'
import { PlanLimitError } from '@/lib/errors'

// Import mocked prisma for test assertions
import { prisma } from '@/lib/prisma'

const mockOrgFindUnique = vi.mocked(prisma.organization.findUnique)
const mockWorkerCount = vi.mocked(prisma.worker.count)
const mockTruckCount = vi.mocked(prisma.truck.count)
const mockTransactionCount = vi.mocked(prisma.transaction.count)

describe('T5.4: PlanService', () => {
  let service: PlanService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PlanService()
  })

  describe('getPlanConfig', () => {
    it('debería retornar límites de FREE para plan FREE', () => {
      const config = service.getPlanConfig('FREE')
      expect(config.trucks).toBe(5)
      expect(config.workers).toBe(10)
      expect(config.transactions).toBe(100)
    })

    it('debería retornar límites de PRO para plan PRO', () => {
      const config = service.getPlanConfig('PRO')
      expect(config.trucks).toBe(50)
      expect(config.workers).toBe(100)
      expect(config.transactions).toBe(Infinity)
    })

    it('debería retornar límites de ENTERPRISE para plan ENTERPRISE', () => {
      const config = service.getPlanConfig('ENTERPRISE')
      expect(config.trucks).toBe(Infinity)
      expect(config.workers).toBe(Infinity)
      expect(config.transactions).toBe(Infinity)
    })
  })

  describe('checkLimit', () => {
    it('debería lanzar PlanLimitError cuando FREE org supera límite de trucks (5)', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'FREE' } as any)
      mockTruckCount.mockResolvedValue(5)

      await expect(service.checkLimit('org-1', 'trucks')).rejects.toThrow(PlanLimitError)
    })

    it('debería lanzar PlanLimitError cuando FREE org supera límite de workers (10)', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'FREE' } as any)
      mockWorkerCount.mockResolvedValue(10)

      await expect(service.checkLimit('org-1', 'workers')).rejects.toThrow(PlanLimitError)
    })

    it('debería lanzar PlanLimitError cuando FREE org supera límite de transactions (100)', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'FREE' } as any)
      mockTransactionCount.mockResolvedValue(100)

      await expect(service.checkLimit('org-1', 'transactions')).rejects.toThrow(PlanLimitError)
    })

    it('debería NO lanzar error cuando FREE org está dentro del límite', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'FREE' } as any)
      mockTruckCount.mockResolvedValue(3)

      await expect(service.checkLimit('org-1', 'trucks')).resolves.toBeUndefined()
    })

    it('debería NO lanzar error cuando PRO org tiene 30 trucks (límite es 50)', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'PRO' } as any)
      mockTruckCount.mockResolvedValue(30)

      await expect(service.checkLimit('org-1', 'trucks')).resolves.toBeUndefined()
    })

    it('debería NO lanzar error para ENTERPRISE (Infinity limit)', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'ENTERPRISE' } as any)
      mockTruckCount.mockResolvedValue(1000)

      await expect(service.checkLimit('org-1', 'trucks')).resolves.toBeUndefined()
      await expect(service.checkLimit('org-1', 'workers')).resolves.toBeUndefined()
      await expect(service.checkLimit('org-1', 'transactions')).resolves.toBeUndefined()
    })

    it('debería lanzar PlanLimitError cuando PRO org supera límite de trucks (50)', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'PRO' } as any)
      mockTruckCount.mockResolvedValue(50)

      await expect(service.checkLimit('org-1', 'trucks')).rejects.toThrow(PlanLimitError)
    })

    it('debería lanzar error cuando la org no existe', async () => {
      mockOrgFindUnique.mockResolvedValue(null)

      await expect(service.checkLimit('nonexistent', 'trucks')).rejects.toThrow('Organization not found')
    })

    it('debería usar el organizationId correcto para el tenant filter', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-abc', planType: 'FREE' } as any)
      mockTruckCount.mockResolvedValue(0)

      await service.checkLimit('org-abc', 'trucks')

      expect(mockTruckCount).toHaveBeenCalledWith({ where: { organizationId: 'org-abc' } })
    })

    it('PlanLimitError debería tener resource, limit, plan correctos', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'FREE' } as any)
      mockTruckCount.mockResolvedValue(5)

      try {
        await service.checkLimit('org-1', 'trucks')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(PlanLimitError)
        expect((error as PlanLimitError).resource).toBe('trucks')
        expect((error as PlanLimitError).limit).toBe(5)
        expect((error as PlanLimitError).plan).toBe('FREE')
      }
    })
  })

  describe('Triangulación: límites en el borde', () => {
    it('FREE con exactamente 4 trucks (debajo del límite de 5) → no error', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'FREE' } as any)
      mockTruckCount.mockResolvedValue(4)

      await expect(service.checkLimit('org-1', 'trucks')).resolves.toBeUndefined()
    })

    it('FREE con exactamente 10 workers (límite) → PlanLimitError', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'FREE' } as any)
      mockWorkerCount.mockResolvedValue(10)

      await expect(service.checkLimit('org-1', 'workers')).rejects.toThrow(PlanLimitError)
    })

    it('PRO con exactamente 50 trucks (límite) → PlanLimitError', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'PRO' } as any)
      mockTruckCount.mockResolvedValue(50)

      await expect(service.checkLimit('org-1', 'trucks')).rejects.toThrow(PlanLimitError)
    })

    it('PRO transactions son ilimitadas → no error con count alto', async () => {
      mockOrgFindUnique.mockResolvedValue({ id: 'org-1', planType: 'PRO' } as any)
      mockTransactionCount.mockResolvedValue(10000)

      await expect(service.checkLimit('org-1', 'transactions')).resolves.toBeUndefined()
    })
  })
})