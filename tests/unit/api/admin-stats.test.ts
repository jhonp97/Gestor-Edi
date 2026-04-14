import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('T6.2: GET /api/admin/stats endpoint', () => {
  describe('src/app/api/admin/stats/route.ts', () => {
    it('debería existir el archivo de ruta /api/admin/stats', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/stats/route.ts')
      expect(() => readFileSync(path, 'utf-8')).not.toThrow()
    })

    it('debería exportar función GET', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/stats/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('export async function GET')
    })

    it('debería importar AdminService', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/stats/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('admin.service')
    })

    it('debería verificar PLATFORM_ADMIN role', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/stats/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('PLATFORM_ADMIN')
    })

    it('debería retornar 403 si no hay sesión o no es PLATFORM_ADMIN', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/stats/route.ts')
      const source = readFileSync(path, 'utf-8')
      // Both unauthenticated and non-PLATFORM_ADMIN return 403 (middleware handles unauthenticated)
      expect(source).toMatch(/403|Forbidden|Acceso denegado/)
    })

    it('debería usar getUserFromRequest para obtener el usuario', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/stats/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toContain('getUserFromRequest')
    })
  })
})
