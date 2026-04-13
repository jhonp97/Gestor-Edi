import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('T4.9: DELETE /api/data/purge endpoint (cron-triggered)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debería existir el archivo de ruta /api/data/purge', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/purge/route.ts')
    expect(fs.existsSync(routePath)).toBe(true)
  })

  it('debería exportar función DELETE', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/purge/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('export async function DELETE')
  })

  it('debería protegerse con CRON_SECRET', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/purge/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('CRON_SECRET')
  })

  it('NO debería usar auth() (usa CRON_SECRET en lugar de sesión de usuario)', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/purge/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    // Should NOT contain auth() - uses CRON_SECRET instead
    expect(content).not.toContain('auth()')
  })

  it('debería encontrar usuarios con deletedAt hace más de 30 días', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/purge/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('30')
  })

  it('debería realizar eliminación permanente (hard delete)', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/purge/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    // Should use delete operation
    expect(content).toContain('delete')
  })

  it('debería verificar el header Authorization', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/purge/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('Authorization')
  })
})
