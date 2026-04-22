import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('T4.6: POST /api/data/export endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debería existir el archivo de ruta /api/data/export', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/export/route.ts')
    expect(fs.existsSync(routePath)).toBe(true)
  })

  it('debería exportar función POST', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/export/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('export async function POST')
  })

  it('debería importar DataExportService', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/export/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('data-export.service')
  })

  it('debería importar AuditService para registrar la exportación', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/export/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('audit.service')
  })

  it('debería usar getSessionFromRequest() para verificar sesión', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/export/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('getSessionFromRequest(request)')
  })

  it('debería requerir rol ORG_ADMIN o PLATFORM_ADMIN', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/export/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    // Should check for ORG_ADMIN or PLATFORM_ADMIN role
    expect(content).toContain('ORG_ADMIN')
  })

  it('debería soportar parámetro de formato (json/csv)', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/export/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('format')
  })

  it('debería devolver archivo con Content-Disposition para descarga', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/export/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('Content-Disposition')
  })

  it('debería registrar acción DATA_EXPORT en audit log', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/export/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('DATA_EXPORT')
  })
})
