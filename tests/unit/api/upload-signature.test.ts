import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('API Routes: Upload Signature', () => {
  const routePath = resolve(process.cwd(), 'src/app/api/upload/signature/route.ts')

  it('debería existir /api/upload/signature/route.ts', () => {
    expect(() => readFileSync(routePath, 'utf-8')).not.toThrow()
  })

  it('debería exportar POST', () => {
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toContain('export async function POST')
  })

  it('debería usar getSessionFromRequest', () => {
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toContain('getSessionFromRequest(request)')
  })

  it('debería usar rateLimit', () => {
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toContain('rateLimit')
  })
})
