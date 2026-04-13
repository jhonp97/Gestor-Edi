import { prisma } from '@/lib/prisma'
import type { AuditAction, AuditLogCreate } from '@/schemas/audit.schema'

export class AuditLogRepository {
  async create(data: AuditLogCreate) {
    return prisma.auditLog.create({
      data: {
        action: data.action as AuditAction,
        userId: data.userId,
        organizationId: data.organizationId,
        details: data.details as object,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    })
  }

  async findByOrganizationId(organizationId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit
    return prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })
  }

  async findAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })
  }

  async countByOrganizationId(organizationId: string) {
    return prisma.auditLog.count({
      where: { organizationId },
    })
  }

  async countAll() {
    return prisma.auditLog.count()
  }
}

export const auditLogRepository = new AuditLogRepository()
