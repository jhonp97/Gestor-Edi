import { describe, it, expect, vi } from 'vitest'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

describe('T3.2: DNI Hash Migration', () => {
  describe('Prisma schema changes', () => {
    it('debería tener campo dniHash en Worker model', () => {
      // Read the schema to verify the field exists
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
      const { readFileSync } = require('fs')
      const schema = readFileSync(schemaPath, 'utf8')
      
      // Worker model should have dniHash field
      expect(schema).toMatch(/model Worker \{/)
      expect(schema).toMatch(/dniHash\s+String\?/)
    })

    it('debería tener unique constraint en (dniHash, organizationId)', () => {
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
      const { readFileSync } = require('fs')
      const schema = readFileSync(schemaPath, 'utf8')
      
      // Worker model should have unique index on dniHash + organizationId
      expect(schema).toMatch(/@@unique\(\[dniHash, organizationId\]\)/)
    })

    it('debería mantener campo dni existente', () => {
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
      const { readFileSync } = require('fs')
      const schema = readFileSync(schemaPath, 'utf8')
      
      // dni field should still exist (now stores encrypted values)
      expect(schema).toMatch(/model Worker \{[\s\S]*?^\s+dni\s+String\s*$/m)
    })
  })

  describe('prisma generate', () => {
    it('debería generar PrismaClient exitosamente', { timeout: 60000 }, () => {
      // This will fail if schema is invalid
      // Run in try/catch to avoid breaking the whole test suite
      try {
        execSync('npx prisma generate', { 
          stdio: 'pipe',
          cwd: process.cwd(),
          timeout: 60000 
        })
        // If we get here, generation succeeded
        expect(true).toBe(true)
      } catch (e: unknown) {
        const error = e as { status?: number; stderr?: string }
        // If it fails because already generated, that's OK
        if (error.stderr?.includes('already up to date')) {
          expect(true).toBe(true)
        } else {
          throw e
        }
      }
    })
  })
})
