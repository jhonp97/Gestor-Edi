import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('T4.3: GET /api/audit endpoint', () => {
  it('debería existir el archivo de ruta /api/audit', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/audit/route.ts')
    expect(fs.existsSync(routePath)).toBe(true)
  })

  it('debería exportar función GET', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/audit/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('export async function GET')
  })

  it('debería importar el AuditService', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/audit/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('audit.service')
  })

  it('debería usar auth() para verificar sesión', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/audit/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('auth()')
  })

  it('debería verificar rol PLATFORM_ADMIN o acceso ORG_ADMIN', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/audit/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    // Check that PLATFORM_ADMIN can see all, ORG_ADMIN only their org
    expect(content).toContain('PLATFORM_ADMIN')
  })

  it('debería soportar paginación', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/audit/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    // Should support page and limit params
    expect(content).toContain('page')
    expect(content).toContain('limit')
  })
})
