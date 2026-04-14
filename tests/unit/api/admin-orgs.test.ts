import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('T6.3: GET /api/admin/orgs endpoint', () => {
  describe('src/app/api/admin/orgs/route.ts', () => {
    it('debería existir el archivo de ruta /api/admin/orgs', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/orgs/route.ts')
      expect(() => readFileSync(path, 'utf-8')).not.toThrow()
    })

    it('debería exportar función GET', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/orgs/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('export async function GET')
    })

    it('debería importar AdminService', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/orgs/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('admin.service')
    })

    it('debería verificar PLATFORM_ADMIN role', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/orgs/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('PLATFORM_ADMIN')
    })

    it('debería retornar 403 si no hay sesión o no es PLATFORM_ADMIN', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/orgs/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/403|Forbidden|Acceso denegado/)
    })

    it('debería soportar paginación (page, limit)', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/orgs/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/page|limit/)
    })
  })
})
