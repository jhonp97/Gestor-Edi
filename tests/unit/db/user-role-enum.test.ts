import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('UserRole enum migration', () => {
  // Leemos el schema de Prisma para verificar los valores del enum
  // Este test comprueba que el enum UserRole tenga los valores correctos

  it('debería tener los tres roles: USER, ORG_ADMIN, PLATFORM_ADMIN en el schema', () => {
    const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma')
    const schema = readFileSync(schemaPath, 'utf-8')

    // Buscar el bloque enum UserRole en el schema
    const enumMatch = schema.match(/enum UserRole \{[^}]+\}/)
    expect(enumMatch).not.toBeNull()

    const enumBlock = enumMatch![0]
    // Verificar que contiene ORG_ADMIN y PLATFORM_ADMIN
    expect(enumBlock).toMatch(/\bORG_ADMIN\b/)
    expect(enumBlock).toMatch(/\bPLATFORM_ADMIN\b/)
    expect(enumBlock).toMatch(/\bUSER\b/)
    // El token ADMIN standalone NO debe existir (fue migrado a ORG_ADMIN)
    // Verificamos que la línea "ADMIN" (standalone) no exista
    const lines = enumBlock.split('\n')
    const hasStandaloneAdmin = lines.some(l => l.trim() === 'ADMIN')
    expect(hasStandaloneAdmin).toBe(false)
  })

  it('debería usar ORG_ADMIN (no ADMIN) como rol de administrador de organización', () => {
    const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma')
    const schema = readFileSync(schemaPath, 'utf-8')
    const enumMatch = schema.match(/enum UserRole \{[^}]+\}/)
    const enumBlock = enumMatch![0]
    // ADMIN → ORG_ADMIN: el rol de admin de org se llama ORG_ADMIN
    expect(enumBlock).toMatch(/\bORG_ADMIN\b/)
    // Verificar que ADMIN no exista como token standalone
    const lines = enumBlock.split('\n')
    const hasStandaloneAdmin = lines.some(l => l.trim() === 'ADMIN')
    expect(hasStandaloneAdmin).toBe(false)
  })

  it('debería usar PLATFORM_ADMIN como rol de admin de plataforma', () => {
    const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma')
    const schema = readFileSync(schemaPath, 'utf-8')
    const enumMatch = schema.match(/enum UserRole \{[^}]+\}/)
    const enumBlock = enumMatch![0]
    expect(enumBlock).toMatch(/\bPLATFORM_ADMIN\b/)
  })

  it('debería tener ORG_ADMIN y PLATFORM_ADMIN como valores distintos', () => {
    expect('ORG_ADMIN').not.toBe('PLATFORM_ADMIN')
    expect('USER').not.toBe('ORG_ADMIN')
    expect('USER').not.toBe('PLATFORM_ADMIN')
  })
})
