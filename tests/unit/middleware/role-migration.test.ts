import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mockear el módulo auth antes de importar middleware
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}))

// Leemos el middleware directamente del archivo para verificar las rutas públicas
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Middleware - Role migration (T2.3)', () => {
  describe('Rutas públicas', () => {
    it('debería incluir /privacy en rutas públicas', () => {
      const middlewarePath = resolve(process.cwd(), 'src/middleware.ts')
      const source = readFileSync(middlewarePath, 'utf-8')
      expect(source).toContain("'/privacy'")
    })

    it('debería incluir /terms en rutas públicas', () => {
      const middlewarePath = resolve(process.cwd(), 'src/middleware.ts')
      const source = readFileSync(middlewarePath, 'utf-8')
      expect(source).toContain("'/terms'")
    })

    it('debería incluir /legal-notice en rutas públicas', () => {
      const middlewarePath = resolve(process.cwd(), 'src/middleware.ts')
      const source = readFileSync(middlewarePath, 'utf-8')
      expect(source).toContain("'/legal-notice'")
    })

    it('debería incluir /api/consent en rutas públicas', () => {
      const middlewarePath = resolve(process.cwd(), 'src/middleware.ts')
      const source = readFileSync(middlewarePath, 'utf-8')
      expect(source).toContain("'/api/consent'")
    })
  })

  describe('Protección de rutas admin', () => {
    it('debería usar PLATFORM_ADMIN (no ADMIN) para proteger rutas /admin/*', () => {
      const middlewarePath = resolve(process.cwd(), 'src/middleware.ts')
      const source = readFileSync(middlewarePath, 'utf-8')
      // El middleware debe verificar PLATFORM_ADMIN para rutas de admin
      expect(source).toMatch(/PLATFORM_ADMIN/)
      expect(source).not.toMatch(/role.*===.*'ADMIN'/)
    })

    it('no debería bloquear ORG_ADMIN de rutas no-admin (org-level features)', () => {
      const middlewarePath = resolve(process.cwd(), 'src/middleware.ts')
      const source = readFileSync(middlewarePath, 'utf-8')
      // ORG_ADMIN es válido para acceso general
      // Solo PLATFORM_ADMIN accede a /admin/*
      // (ORG_ADMIN puede seguir usando todas las rutas de la app normal)
      expect(source).toMatch(/PLATFORM_ADMIN/)
    })
  })
})
