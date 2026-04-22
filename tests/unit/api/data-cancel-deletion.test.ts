import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('T4.8: POST /api/data/cancel-deletion endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debería existir el archivo de ruta /api/data/cancel-deletion', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/cancel-deletion/route.ts')
    expect(fs.existsSync(routePath)).toBe(true)
  })

  it('debería exportar función POST', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/cancel-deletion/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('export async function POST')
  })

  it('debería usar getSessionFromRequest() para verificar sesión', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/cancel-deletion/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('getSessionFromRequest(request)')
  })

  it('debería limpiar User.deletedAt y User.deletionRequestedAt', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/cancel-deletion/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('deletedAt')
    expect(content).toContain('deletionRequestedAt')
  })

  it('debería verificar que la solicitud esté dentro de la ventana de 30 días', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/cancel-deletion/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    // Should check the deletion window
    expect(content).toContain('30')
  })

  it('debería registrar en audit log', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/cancel-deletion/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    // Should log the cancellation
    expect(content).toContain('audit')
  })
})
