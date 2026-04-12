import { prisma } from '@/lib/prisma'

export abstract class BaseRepository {
  protected prisma = prisma
  protected organizationId: string | null

  constructor(organizationId?: string | null) {
    this.organizationId = organizationId ?? null
  }

  protected tenantFilter(): Record<string, string> {
    if (!this.organizationId) return {}
    return { organizationId: this.organizationId }
  }
}
