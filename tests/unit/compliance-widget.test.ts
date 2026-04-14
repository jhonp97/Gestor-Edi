import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('T6.6: Compliance Widget', () => {
  describe('src/components/admin/compliance-widget.tsx', () => {
    it('debería existir el componente compliance-widget', () => {
      const path = resolve(process.cwd(), 'src/components/admin/compliance-widget.tsx')
      expect(() => readFileSync(path, 'utf-8')).not.toThrow()
    })

    it('debería importar Card de shadcn', () => {
      const path = resolve(process.cwd(), 'src/components/admin/compliance-widget.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('Card')
    })

    it('debería mostrar consentimiento stats (consent coverage)', () => {
      const path = resolve(process.cwd(), 'src/components/admin/compliance-widget.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/consent|aceptación/i)
    })

    it('debería mostrar pending deletion requests', () => {
      const path = resolve(process.cwd(), 'src/components/admin/compliance-widget.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/deletion|eliminación|borrado/i)
    })

    it('debería mostrar last audit log timestamp', () => {
      const path = resolve(process.cwd(), 'src/components/admin/compliance-widget.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/audit|último|recent/i)
    })

    it('debería recibir props con consentStats y pendingDeletions', () => {
      const path = resolve(process.cwd(), 'src/components/admin/compliance-widget.tsx')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/consentStats|consent/i)
      expect(source).toMatch(/pendingDeletions|deletion/i)
    })
  })
})
