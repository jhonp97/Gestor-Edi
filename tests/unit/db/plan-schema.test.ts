import { describe, it, expect } from 'vitest'

describe('T5.1: Plan Schema Extensions', () => {
  describe('Prisma schema plan fields', () => {
    it('debería tener PlanType enum en el schema (FREE, PRO, ENTERPRISE)', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      expect(content).toContain('enum PlanType')
      expect(content).toContain('FREE')
      expect(content).toContain('PRO')
      expect(content).toContain('ENTERPRISE')
    })

    it('debería tener PlanStatus enum en el schema (TRIAL, ACTIVE, PAST_DUE, CANCELED)', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      expect(content).toContain('enum PlanStatus')
      expect(content).toContain('TRIAL')
      expect(content).toContain('ACTIVE')
      expect(content).toContain('PAST_DUE')
      expect(content).toContain('CANCELED')
    })

    it('debería tener campos de plan en Organization (planType, planStatus, billingEmail, billingVatId, currency)', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      expect(content).toContain('planType')
      expect(content).toContain('planStatus')
      expect(content).toContain('billingEmail')
      expect(content).toContain('billingVatId')
      expect(content).toContain('currency')
    })

    it('debería tener plan defaults (FREE, TRIAL, EUR)', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      expect(content).toContain('@default(FREE)')
      expect(content).toContain('@default(TRIAL)')
      expect(content).toContain('@default("EUR")')
    })

    it('debería tener Organization con trucks, workers, transactions en relación', () => {
      const fs = require('fs')
      const path = require('path')
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      expect(content).toContain('trucks')
      expect(content).toContain('workers')
      expect(content).toContain('transactions')
    })
  })
})
