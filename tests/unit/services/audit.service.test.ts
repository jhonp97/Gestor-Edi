import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrismaAuditLog = {
  create: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: mockPrismaAuditLog,
  },
}))

describe('T4.2: AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DNI_ENCRYPTION_KEY = 'a'.repeat(32)
    vi.resetModules()
  })

  describe('audit.schema.ts', () => {
    it('debería existir el archivo de esquema Zod', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'src/schemas/audit.schema.ts')
      expect(fs.existsSync(schemaPath)).toBe(true)
    })

    it('debería exportar AuditAction enum', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'src/schemas/audit.schema.ts')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      expect(content).toContain('DATA_EXPORT')
      expect(content).toContain('DATA_DELETE_REQUEST')
      expect(content).toContain('ORG_UPDATE')
      expect(content).toContain('ROLE_CHANGE')
      expect(content).toContain('PLATFORM_ADMIN_WRITE')
      expect(content).toContain('CONSENT_CHANGE')
    })
  })

  describe('audit-log.repository.ts', () => {
    it('debería existir el repositorio de audit logs', () => {
      const fs = require('fs')
      const path = require('path')
      const repoPath = path.join(process.cwd(), 'src/repositories/audit-log.repository.ts')
      expect(fs.existsSync(repoPath)).toBe(true)
    })

    it('debería exportar método create', () => {
      const fs = require('fs')
      const path = require('path')
      const repoPath = path.join(process.cwd(), 'src/repositories/audit-log.repository.ts')
      const content = fs.readFileSync(repoPath, 'utf-8')
      expect(content).toContain('create')
    })

    it('debería exportar método findByOrganizationId', () => {
      const fs = require('fs')
      const path = require('path')
      const repoPath = path.join(process.cwd(), 'src/repositories/audit-log.repository.ts')
      const content = fs.readFileSync(repoPath, 'utf-8')
      expect(content).toContain('findByOrganizationId')
    })

    it('debería exportar método findAll', () => {
      const fs = require('fs')
      const path = require('path')
      const repoPath = path.join(process.cwd(), 'src/repositories/audit-log.repository.ts')
      const content = fs.readFileSync(repoPath, 'utf-8')
      expect(content).toContain('findAll')
    })

    it('NO debería exportar método update (inmutable)', () => {
      const fs = require('fs')
      const path = require('path')
      const repoPath = path.join(process.cwd(), 'src/repositories/audit-log.repository.ts')
      const content = fs.readFileSync(repoPath, 'utf-8')
      expect(content).not.toContain('.update(')
    })

    it('NO debería exportar método delete (inmutable)', () => {
      const fs = require('fs')
      const path = require('path')
      const repoPath = path.join(process.cwd(), 'src/repositories/audit-log.repository.ts')
      const content = fs.readFileSync(repoPath, 'utf-8')
      expect(content).not.toContain('.delete(')
    })
  })

  describe('audit.service.ts', () => {
    it('debería existir el servicio de audit', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/audit.service.ts')
      expect(fs.existsSync(servicePath)).toBe(true)
    })

    it('debería exportar método log', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/audit.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
      expect(content).toContain('log(')
    })

    it('debería exportar método getByOrg', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/audit.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
      expect(content).toContain('getByOrg(')
    })

    it('debería exportar método getAll', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/audit.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
      expect(content).toContain('getAll(')
    })

    it('NO debería exportar método update (inmutable)', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/audit.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
      expect(content).not.toContain('update(')
    })

    it('NO debería exportar método delete (inmutable)', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/audit.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
      expect(content).not.toContain('delete(')
    })
  })

  describe('Functional test: AuditService.log', () => {
    it('debería crear un registro de audit log', async () => {
      const mockAuditLog = {
        id: 'test-id',
        action: 'DATA_EXPORT',
        userId: 'user-123',
        organizationId: 'org-456',
        details: { format: 'json' },
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
      }

      mockPrismaAuditLog.create.mockResolvedValue(mockAuditLog)

      const { AuditService } = await import('@/services/audit.service')
      const service = new AuditService()
      const result = await service.log('DATA_EXPORT', 'user-123', 'org-456', { format: 'json' }, '192.168.1.1', 'Mozilla/5.0')

      expect(result).toEqual(mockAuditLog)
      expect(mockPrismaAuditLog.create).toHaveBeenCalledTimes(1)
    })
  })
})
