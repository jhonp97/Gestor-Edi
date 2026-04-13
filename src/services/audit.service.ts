import { auditLogRepository } from '@/repositories/audit-log.repository'
import type { AuditAction, AuditLogQuery } from '@/schemas/audit.schema'

export class AuditService {
  async log(
    action: AuditAction,
    userId: string | null,
    organizationId: string | null,
    details?: Record<string, unknown>,
    ip?: string,
    userAgent?: string
  ) {
    return auditLogRepository.create({
      action,
      userId: userId || undefined,
      organizationId: organizationId || undefined,
      details,
      ip,
      userAgent,
    })
  }

  async getByOrg(organizationId: string, pagination?: AuditLogQuery) {
    const page = pagination?.page ?? 1
    const limit = pagination?.limit ?? 50
    return auditLogRepository.findByOrganizationId(organizationId, page, limit)
  }

  async getAll(pagination?: AuditLogQuery) {
    const page = pagination?.page ?? 1
    const limit = pagination?.limit ?? 50
    return auditLogRepository.findAll(page, limit)
  }
}

export const auditService = new AuditService()
