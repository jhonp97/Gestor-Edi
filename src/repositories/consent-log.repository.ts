import { BaseRepository } from './base.repository'
import { prisma } from '@/lib/prisma'
import type { ConsentCategories } from '@/schemas/consent.schema'

export class ConsentLogRepository extends BaseRepository {
  async create(data: {
    userId?: string
    categories: ConsentCategories
    ip?: string
    userAgent?: string
    organizationId?: string
  }) {
    return prisma.consentLog.create({
      data: {
        userId: data.userId,
        categories: data.categories as object,
        ip: data.ip,
        userAgent: data.userAgent,
        organizationId: data.organizationId,
      },
    })
  }

  async findByOrganizationId(organizationId: string) {
    return prisma.consentLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getStats() {
    const total = await prisma.consentLog.count()
    const withAnalytics = await prisma.consentLog.count({
      where: {
        categories: {
          path: ['analytics'],
          equals: true,
        },
      },
    })
    const withMarketing = await prisma.consentLog.count({
      where: {
        categories: {
          path: ['marketing'],
          equals: true,
        },
      },
    })
    return { total, withAnalytics, withMarketing }
  }
}
