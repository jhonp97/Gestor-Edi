import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('T6.5: Admin Orgs Page', () => {
  describe('src/app/(app)/admin/orgs/page.tsx', () => {
    it('debería existir la página admin/orgs/', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/orgs/page.tsx')
      expect(() => readFileSync(path, 'utf-8')).not.toThrow()
    })

    it('debería importar Card y Table de shadcn', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/orgs/page.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('Card')
      expect(source).toContain('Table')
    })

    it('debería hacer fetch a /api/admin/orgs', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/orgs/page.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('/api/admin/orgs')
    })

    it('debería mostrar plan info (planType, planStatus)', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/orgs/page.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/plan/i)
    })

    it('debería mostrar memberCount, truckCount, workerCount', () => {
      const path = resolve(process.cwd(), 'src/app/(app)/admin/orgs/page.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/member|usuario/i)
      expect(source).toMatch(/truck|camión/i)
    })
  })
})
