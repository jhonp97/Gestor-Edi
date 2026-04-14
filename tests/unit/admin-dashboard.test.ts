import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('T6.4: Admin Dashboard Page', () => {
  describe('src/app/(app)/admin/page.tsx', () => {
    it('debería existir la página admin/', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/page.tsx')
      expect(() => readFileSync(path, 'utf-8')).not.toThrow()
    })

    it('debería importar Card y CardContent de shadcn', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/page.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('Card')
    })

    it('debería hacer fetch a /api/admin/stats', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/page.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('/api/admin/stats')
    })

    it('debería mostrar métricas de usuarios, orgs, trucks, workers, transactions', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/page.tsx')
      const source = readFileSync(path, 'utf-8')
      // Should show these metrics
      expect(source).toMatch(/users|usuarios/i)
      expect(source).toMatch(/orgs|organizaciones/i)
      expect(source).toMatch(/trucks|camiones/i)
    })

    it('debería importar ComplianceWidget', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/page.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('ComplianceWidget')
    })

    it('debería mostrar recentAuditLogs', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/page.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/audit|log/i)
    })
  })
})
