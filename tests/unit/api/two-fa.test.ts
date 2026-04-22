import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('API Routes: 2FA', () => {
  it('debería existir /api/2fa/send-code/route.ts', () => {
    const routePath = resolve(process.cwd(), 'src/app/api/2fa/send-code/route.ts')
    expect(() => readFileSync(routePath, 'utf-8')).not.toThrow()
  })

  it('debería existir /api/2fa/verify/route.ts', () => {
    const routePath = resolve(process.cwd(), 'src/app/api/2fa/verify/route.ts')
    expect(() => readFileSync(routePath, 'utf-8')).not.toThrow()
  })

  it('debería existir /api/2fa/disable/route.ts', () => {
    const routePath = resolve(process.cwd(), 'src/app/api/2fa/disable/route.ts')
    expect(() => readFileSync(routePath, 'utf-8')).not.toThrow()
  })

  it('send-code debería usar getSessionFromRequest y rateLimit', () => {
    const content = readFileSync(resolve(process.cwd(), 'src/app/api/2fa/send-code/route.ts'), 'utf-8')
    expect(content).toContain('getSessionFromRequest(request)')
    expect(content).toContain('rateLimit')
  })

  it('verify debería usar getSessionFromRequest', () => {
    const content = readFileSync(resolve(process.cwd(), 'src/app/api/2fa/verify/route.ts'), 'utf-8')
    expect(content).toContain('getSessionFromRequest(request)')
  })

  it('disable debería usar getSessionFromRequest y rateLimit', () => {
    const content = readFileSync(resolve(process.cwd(), 'src/app/api/2fa/disable/route.ts'), 'utf-8')
    expect(content).toContain('getSessionFromRequest(request)')
    expect(content).toContain('rateLimit')
  })
})
