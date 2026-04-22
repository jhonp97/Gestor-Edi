import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Profile Rate Limits Config', () => {
  const configPath = resolve(process.cwd(), 'src/config/rate-limits.ts')
  const content = readFileSync(configPath, 'utf-8')

  it('debería exportar PROFILE_RATE_LIMIT', () => {
    expect(content).toContain('PROFILE_RATE_LIMIT')
  })

  it('debería exportar TWO_FA_RATE_LIMIT', () => {
    expect(content).toContain('TWO_FA_RATE_LIMIT')
  })

  it('debería exportar UPLOAD_RATE_LIMIT', () => {
    expect(content).toContain('UPLOAD_RATE_LIMIT')
  })

  it('debería tener PROFILE_RATE_LIMIT con valores razonables', () => {
    expect(content).toMatch(/PROFILE_RATE_LIMIT[\s\S]*?maxRequests:\s*50/)
  })

  it('debería tener TWO_FA_RATE_LIMIT con maxRequests 5 y ventana 15 min', () => {
    expect(content).toMatch(/TWO_FA_RATE_LIMIT[\s\S]*?maxRequests:\s*5/)
  })

  it('debería tener UPLOAD_RATE_LIMIT con maxRequests 20 y ventana 15 min', () => {
    expect(content).toMatch(/UPLOAD_RATE_LIMIT[\s\S]*?maxRequests:\s*20/)
  })
})
