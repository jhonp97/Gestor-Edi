import { z } from 'zod'

export const AuditActionSchema = z.enum([
  'DATA_EXPORT',
  'DATA_DELETE_REQUEST',
  'ORG_UPDATE',
  'ROLE_CHANGE',
  'PLATFORM_ADMIN_WRITE',
  'CONSENT_CHANGE',
])

export const AuditLogCreateSchema = z.object({
  action: AuditActionSchema,
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
})

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

export type AuditAction = z.infer<typeof AuditActionSchema>
export type AuditLogCreate = z.infer<typeof AuditLogCreateSchema>
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>
