import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  user: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  organization: { count: vi.fn(), findMany: vi.fn() },
  worker: { count: vi.fn() },
  truck: { count: vi.fn() },
  transaction: { count: vi.fn() },
  consentLog: { count: vi.fn(), findMany: vi.fn() },
  auditLog: { count: vi.fn(), findMany: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

describe('T6.1: AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPlatformStats', () => {
    it('debería retornar estadísticas de plataforma con todos los contadores', async () => {
      const { AdminService } = await import('@/services/admin.service')
      const service = new AdminService()

      // Setup mock resolves in call order (Promise.all fires all simultaneously)
      mockPrisma.user.count
        .mockResolvedValueOnce(50) // users
        .mockResolvedValueOnce(10) // pendingDeletions
      mockPrisma.organization.count.mockResolvedValue(10)
      mockPrisma.worker.count.mockResolvedValue(200)
      mockPrisma.truck.count.mockResolvedValue(30)
      mockPrisma.transaction.count.mockResolvedValue(5000)
      mockPrisma.consentLog.count.mockResolvedValue(45)
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      mockPrisma.auditLog.count.mockResolvedValue(0)

      const stats = await service.getPlatformStats()

      expect(stats.users).toBe(50)
      expect(stats.orgs).toBe(10)
      expect(stats.workers).toBe(200)
      expect(stats.trucks).toBe(30)
      expect(stats.transactions).toBe(5000)
    })

    it('debería incluir consentStats con total de consent logs', async () => {
      const { AdminService } = await import('@/services/admin.service')
      const service = new AdminService()

      mockPrisma.user.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
      mockPrisma.organization.count.mockResolvedValue(0)
      mockPrisma.worker.count.mockResolvedValue(0)
      mockPrisma.truck.count.mockResolvedValue(0)
      mockPrisma.transaction.count.mockResolvedValue(0)
      mockPrisma.consentLog.count.mockResolvedValue(20)
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      mockPrisma.auditLog.count.mockResolvedValue(0)

      const stats = await service.getPlatformStats()

      expect(stats.consentStats).toBeDefined()
      expect(stats.consentStats.total).toBe(20)
    })

    it('debería incluir recentAuditLogs (últimos 10)', async () => {
      const { AdminService } = await import('@/services/admin.service')
      const service = new AdminService()

      const mockLogs = [
        { id: '1', action: 'DATA_EXPORT', createdAt: new Date() },
        { id: '2', action: 'ORG_UPDATE', createdAt: new Date() },
      ]

      // Setup mock resolves in call order
      mockPrisma.user.count
        .mockResolvedValueOnce(0) // users
        .mockResolvedValueOnce(0) // pendingDeletions
      mockPrisma.organization.count.mockResolvedValue(0)
      mockPrisma.worker.count.mockResolvedValue(0)
      mockPrisma.truck.count.mockResolvedValue(0)
      mockPrisma.transaction.count.mockResolvedValue(0)
      mockPrisma.consentLog.count.mockResolvedValue(0)
      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs)
      mockPrisma.auditLog.count.mockResolvedValue(2)

      const stats = await service.getPlatformStats()

      expect(stats.recentAuditLogs).toHaveLength(2)
      expect(stats.recentAuditLogs[0].action).toBe('DATA_EXPORT')
    })

    it('debería incluir pendingDeletions count', async () => {
      const { AdminService } = await import('@/services/admin.service')
      const service = new AdminService()

      // Setup mock resolves in call order
      mockPrisma.user.count
        .mockResolvedValueOnce(0) // users
        .mockResolvedValueOnce(3) // pendingDeletions
      mockPrisma.organization.count.mockResolvedValue(0)
      mockPrisma.worker.count.mockResolvedValue(0)
      mockPrisma.truck.count.mockResolvedValue(0)
      mockPrisma.transaction.count.mockResolvedValue(0)
      mockPrisma.consentLog.count.mockResolvedValue(0)
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      mockPrisma.auditLog.count.mockResolvedValue(0)

      const stats = await service.getPlatformStats()

      expect(stats.pendingDeletions).toBe(3)
    })
  })

  describe('getOrgList', () => {
    it('debería retornar lista de orgs con memberCount, truckCount, workerCount', async () => {
      const { AdminService } = await import('@/services/admin.service')
      const service = new AdminService()

      const mockOrgs = [
        {
          id: 'org-1',
          name: 'Empresa A',
          planType: 'PRO',
          planStatus: 'ACTIVE',
          createdAt: new Date('2025-01-01'),
        },
      ]

      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs)
      mockPrisma.user.count.mockResolvedValue(5)
      mockPrisma.truck.count.mockResolvedValue(3)
      mockPrisma.worker.count.mockResolvedValue(10)
      mockPrisma.transaction.count.mockResolvedValue(100)

      const orgs = await service.getOrgList()

      expect(orgs).toHaveLength(1)
      expect(orgs[0].id).toBe('org-1')
      expect(orgs[0].name).toBe('Empresa A')
      expect(orgs[0].planType).toBe('PRO')
      expect(orgs[0].memberCount).toBe(5)
      expect(orgs[0].truckCount).toBe(3)
      expect(orgs[0].workerCount).toBe(10)
      expect(orgs[0].transactionCount).toBe(100)
    })

    it('debería usar skip/take para paginación', async () => {
      const { AdminService } = await import('@/services/admin.service')
      const service = new AdminService()

      mockPrisma.organization.findMany.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.truck.count.mockResolvedValue(0)
      mockPrisma.worker.count.mockResolvedValue(0)
      mockPrisma.transaction.count.mockResolvedValue(0)

      await service.getOrgList({ page: 2, limit: 5 })

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      )
    })

    it('debería ordenar por createdAt desc', async () => {
      const { AdminService } = await import('@/services/admin.service')
      const service = new AdminService()

      mockPrisma.organization.findMany.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.truck.count.mockResolvedValue(0)
      mockPrisma.worker.count.mockResolvedValue(0)
      mockPrisma.transaction.count.mockResolvedValue(0)

      await service.getOrgList()

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      )
    })
  })
})
