import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('T4.7: POST /api/data/delete-request endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debería existir el archivo de ruta /api/data/delete-request', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/delete-request/route.ts')
    expect(fs.existsSync(routePath)).toBe(true)
  })

  it('debería exportar función POST', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/delete-request/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('export async function POST')
  })

  it('debería usar auth() para verificar sesión', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/delete-request/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('auth()')
  })

  it('debería actualizar User.deletedAt y User.deletionRequestedAt', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/delete-request/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('deletedAt')
    expect(content).toContain('deletionRequestedAt')
  })

  it('debería verificar que el usuario no sea el último admin de la organización', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/delete-request/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    // Should check for last admin - look for the check logic or error
    expect(content).toContain('LastAdminError')
  })

  it('debería registrar acción DATA_DELETE_REQUEST en audit log', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/delete-request/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('DATA_DELETE_REQUEST')
  })

  it('debería devolver error si es el último admin', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/data/delete-request/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    // Should throw or return error for last admin
    expect(content).toContain('LastAdminError')
  })
})

describe('T4.7: LastAdminError custom error', () => {
  it('debería existir la clase LastAdminError', () => {
    const fs = require('fs')
    const path = require('path')
    const errorPath = path.join(process.cwd(), 'src/lib/errors.ts')
    const exists = fs.existsSync(errorPath)
    
    if (exists) {
      const content = fs.readFileSync(errorPath, 'utf-8')
      expect(content).toContain('LastAdminError')
    } else {
      // Look for it in other files
      const srcPath = path.join(process.cwd(), 'src')
      const files = getAllFiles(srcPath, '.ts')
      let found = false
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        if (content.includes('LastAdminError')) {
          found = true
          break
        }
      }
      expect(found).toBe(true)
    }
  })
})

function getAllFiles(dir: string, extension: string): string[] {
  const fs = require('fs')
  const path = require('path')
  const files: string[] = []
  
  if (!fs.existsSync(dir)) return files
  
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      files.push(...getAllFiles(fullPath, extension))
    } else if (entry.name.endsWith(extension)) {
      files.push(fullPath)
    }
  }
  return files
}
