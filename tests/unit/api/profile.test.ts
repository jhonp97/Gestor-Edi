import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('API Routes: Profile', () => {
  const routePath = resolve(process.cwd(), 'src/app/api/profile/route.ts')

  it('debería existir /api/profile/route.ts', () => {
    expect(() => readFileSync(routePath, 'utf-8')).not.toThrow()
  })

  it('debería exportar GET y PATCH', () => {
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toContain('export async function GET')
    expect(content).toContain('export async function PATCH')
  })

  it('debería usar getSessionFromRequest', () => {
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toContain('getSessionFromRequest(request)')
  })

  it('debería usar rateLimit', () => {
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toContain('rateLimit')
  })

  it('debería usar updateProfileSchema', () => {
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toContain('updateProfileSchema')
  })
})
