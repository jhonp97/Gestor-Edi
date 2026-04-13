import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'fs'
import path from 'path'

describe('T3.3: DNI Migration Script', () => {
  it('debería existir el script de migración de DNI', () => {
    const scriptPath = path.join(process.cwd(), 'prisma', 'migrate-dni-encryption.ts')
    expect(existsSync(scriptPath)).toBe(true)
  })

  it('debería ser un archivo TypeScript ejecutable', () => {
    const scriptPath = path.join(process.cwd(), 'prisma', 'migrate-dni-encryption.ts')
    const { readFileSync } = require('fs')
    const content = readFileSync(scriptPath, 'utf8')
    
    // Should import encryption utilities
    expect(content).toMatch(/encrypt/)
    expect(content).toMatch(/hash/)
    // Should process Worker records
    expect(content).toMatch(/Worker/)
    // Should handle the migration in batches or all records
    expect(content).toMatch(/findMany|findMany\(|forEach/)
  })

  it('debería usar EncryptionService o funciones de encryption.ts', () => {
    const scriptPath = path.join(process.cwd(), 'prisma', 'migrate-dni-encryption.ts')
    const { readFileSync } = require('fs')
    const content = readFileSync(scriptPath, 'utf8')
    
    // Should reference the encryption lib
    expect(content).toMatch(/@\/lib\/encryption|encryption\.encrypt|encrypt\(|EncryptionService/)
  })
})
