import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Admin routes - Role migration (T2.4)', () => {
  describe('src/app/api/admin/users/route.ts', () => {
    it('debería usar PLATFORM_ADMIN para proteger GET /api/admin/users', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/users/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/PLATFORM_ADMIN/)
      expect(source).not.toMatch(/role.*===.*'ADMIN'/)
    })
  })

  describe('src/app/api/admin/users/[id]/route.ts', () => {
    it('debería usar PLATFORM_ADMIN para proteger PATCH /api/admin/users/[id]', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/users/[id]/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/PLATFORM_ADMIN/)
      expect(source).not.toMatch(/role.*===.*'ADMIN'/)
    })

    it('debería usar PLATFORM_ADMIN para proteger DELETE /api/admin/users/[id]', () => {
      const path = resolve(process.cwd(), 'src/app/api/admin/users/[id]/route.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/PLATFORM_ADMIN/)
    })
  })

  describe('src/schemas/auth.schema.ts', () => {
    it('debería usar ORG_ADMIN y PLATFORM_ADMIN en changeRoleSchema', () => {
      const path = resolve(process.cwd(), 'src/schemas/auth.schema.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/ORG_ADMIN/)
      expect(source).toMatch(/PLATFORM_ADMIN/)
    })
  })

  describe('src/repositories/user.repository.ts', () => {
    it('debería usar ORG_ADMIN y PLATFORM_ADMIN en updateRole', () => {
      const path = resolve(process.cwd(), 'src/repositories/user.repository.ts')
      const source = readFileSync(path, 'utf-8')
      expect(source).toMatch(/ORG_ADMIN/)
      expect(source).toMatch(/PLATFORM_ADMIN/)
    })
  })
})
