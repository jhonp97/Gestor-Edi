/**
 * Admin Service — platform-level statistics and org management.
 * Used by the admin dashboard (PLATFORM_ADMIN only).
 */
import { prisma } from '@/lib/prisma'
import type { PlanType, PlanStatus } from '@prisma/client'

export interface PlatformStats {
  users: number
  orgs: number
  workers: number
  trucks: number
  transactions: number
  consentStats: {
    total: number
  }
  pendingDeletions: number
  recentAuditLogs: Array<{
    id: string
    action: string
    createdAt: Date
    userId?: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: any // JsonValue from Prisma
  }>
}

export interface OrgListEntry {
  id: string
  name: string
  planType: PlanType
  planStatus: PlanStatus
  memberCount: number
  truckCount: number
  workerCount: number
  transactionCount: number
  createdAt: Date
}

export interface Pagination {
  page?: number
  limit?: number
}

export class AdminService {
  /**
   * Get platform-wide statistics across all organizations.
   * Only accessible by PLATFORM_ADMIN.
   */
  async getPlatformStats(): Promise<PlatformStats> {
    const [users, orgs, workers, trucks, transactions, consentStats, pendingDeletions, recentAuditLogs] =
      await Promise.all([
        prisma.user.count(),
        prisma.organization.count(),
        prisma.worker.count(),
        prisma.truck.count(),
        prisma.transaction.count(),
        prisma.consentLog.count(),
        prisma.user.count({ where: { deletionRequestedAt: { not: null }, deletedAt: null } }),
        prisma.auditLog.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      ])

    return {
      users,
      orgs,
      workers,
      trucks,
      transactions,
      consentStats: {
        total: consentStats,
      },
      pendingDeletions,
      recentAuditLogs,
    }
  }

  /**
   * Get paginated list of organizations with plan info and resource counts.
   */
  async getOrgList(pagination?: Pagination): Promise<OrgListEntry[]> {
    const page = pagination?.page ?? 1
    const limit = pagination?.limit ?? 50
    const skip = (page - 1) * limit

    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    // Fetch counts for each org in parallel
    const orgsWithCounts = await Promise.all(
      organizations.map(async (org) => {
        const [memberCount, truckCount, workerCount, transactionCount] = await Promise.all([
          prisma.user.count({ where: { organizationId: org.id } }),
          prisma.truck.count({ where: { organizationId: org.id } }),
          prisma.worker.count({ where: { organizationId: org.id } }),
          prisma.transaction.count({ where: { organizationId: org.id } }),
        ])

        return {
          id: org.id,
          name: org.name,
          planType: org.planType,
          planStatus: org.planStatus,
          memberCount,
          truckCount,
          workerCount,
          transactionCount,
          createdAt: org.createdAt,
        }
      })
    )

    return orgsWithCounts
  }
}

export const adminService = new AdminService()
