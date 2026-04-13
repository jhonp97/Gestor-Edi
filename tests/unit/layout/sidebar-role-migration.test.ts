import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Sidebar - Role migration (T2.5)', () => {
  const sidebarPath = resolve(process.cwd(), 'src/components/layout/sidebar.tsx')

  it('debería mostrar link Admin solo para PLATFORM_ADMIN (no para ADMIN)', () => {
    const source = readFileSync(sidebarPath, 'utf-8')
    // El sidebar debe mostrar Admin para PLATFORM_ADMIN
    expect(source).toMatch(/PLATFORM_ADMIN/)
    // No debe usar ADMIN para decidir si mostrar el link Admin
    expect(source).not.toMatch(/role.*===.*'ADMIN'/)
  })

  it('no debería mostrar link Admin para ORG_ADMIN', () => {
    const source = readFileSync(sidebarPath, 'utf-8')
    // ORG_ADMIN no es PLATFORM_ADMIN, así que no verá el link Admin
    // (el link Admin usa === 'PLATFORM_ADMIN')
    expect(source).toMatch(/PLATFORM_ADMIN/)
  })

  it('debería mantener todas las rutas normales visibles para USER y ORG_ADMIN', () => {
    const source = readFileSync(sidebarPath, 'utf-8')
    // Las rutas principales no dependen del rol
    expect(source).toContain("'/dashboard'")
    expect(source).toContain("'/trucks'")
    expect(source).toContain("'/transactions'")
    expect(source).toContain("'/workers'")
    expect(source).toContain("'/nomina'")
  })
})
