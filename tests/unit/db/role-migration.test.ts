import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Role migration script', () => {
  it('debería usar SQL raw para migrar ADMIN → ORG_ADMIN', () => {
    const scriptPath = resolve(process.cwd(), 'prisma/migrate-roles.ts')
    const script = readFileSync(scriptPath, 'utf-8')
    
    // El script usa $executeRaw con UPDATE SQL porque ADMIN ya no existe en el enum
    expect(script).toContain("'ADMIN'")
    expect(script).toContain("'ORG_ADMIN'")
    expect(script).toMatch(/\$executeRaw|UPDATE.*SET.*role/)
    expect(script).toMatch(/role/)
  })

  it('debería verificar que la migración fue exitosa', () => {
    const scriptPath = resolve(process.cwd(), 'prisma/migrate-roles.ts')
    const script = readFileSync(scriptPath, 'utf-8')
    
    // Verificar que el script verifica el resultado post-migración
    expect(script).toMatch(/remainingAdmin|ADMIN.*0|count.*ADMIN/)
  })
})
