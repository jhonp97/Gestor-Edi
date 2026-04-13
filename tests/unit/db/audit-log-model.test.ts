import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execSync } from 'child_process'

describe('T4.1: AuditLog Prisma model', () => {
  describe('Schema validation', () => {
    it('debería existir el modelo AuditLog en el schema', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      expect(content).toContain('model AuditLog')
    })

    it('debería tener el enum AuditAction con los valores requeridos', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      expect(content).toContain('enum AuditAction')
      expect(content).toContain('DATA_EXPORT')
      expect(content).toContain('DATA_DELETE_REQUEST')
      expect(content).toContain('ORG_UPDATE')
      expect(content).toContain('ROLE_CHANGE')
      expect(content).toContain('PLATFORM_ADMIN_WRITE')
      expect(content).toContain('CONSENT_CHANGE')
    })

    it('debería tener los campos requeridos en AuditLog', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      // Extract AuditLog model block
      const modelMatch = content.match(/model AuditLog \{[\s\S]*?\n\}/)
      expect(modelMatch).not.toBeNull()
      const modelContent = modelMatch![0]
      expect(modelContent).toContain('id             String')
      expect(modelContent).toContain('action         AuditAction')
      expect(modelContent).toContain('userId         String?')
      expect(modelContent).toContain('organizationId String?')
      expect(modelContent).toContain('details        Json?')
      expect(modelContent).toContain('ip             String?')
      expect(modelContent).toContain('userAgent      String?')
      expect(modelContent).toContain('createdAt      DateTime')
    })

    it('debería tener relación User -> AuditLog (uno a muchos)', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      expect(content).toContain('auditLogs             AuditLog[]')
    })
  })

  describe('User soft-delete fields', () => {
    it('debería tener deletedAt en User', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      // Extract User model
      const modelMatch = content.match(/model User \{[\s\S]*?\n\}/)
      expect(modelMatch).not.toBeNull()
      const modelContent = modelMatch![0]
      expect(modelContent).toContain('deletedAt             DateTime?')
    })

    it('debería tener deletionRequestedAt en User', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      // Extract User model
      const modelMatch = content.match(/model User \{[\s\S]*?\n\}/)
      expect(modelMatch).not.toBeNull()
      const modelContent = modelMatch![0]
      expect(modelContent).toContain('deletionRequestedAt   DateTime?')
    })
  })

  describe('Prisma generate', () => {
    beforeEach(() => {
      process.env.DNI_ENCRYPTION_KEY = 'a'.repeat(32)
    })

    it('debería generar el cliente Prisma sin errores', { timeout: 60000 }, () => {
      // This test validates that the schema is syntactically correct
      // We run prisma generate and check it succeeds
      try {
        execSync('pnpm prisma generate', { 
          cwd: process.cwd(), 
          stdio: 'pipe',
          timeout: 60000 
        })
        expect(true).toBe(true)
      } catch (error) {
        expect(error).toBeNull()
      }
    })
  })
})
