import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Profile Page', () => {
  const pagePath = resolve(process.cwd(), 'src/app/(app)/profile/page.tsx')

  it('debería existir la página /profile', () => {
    expect(() => readFileSync(pagePath, 'utf-8')).not.toThrow()
  })

  it('debería usar getSessionUniversal', () => {
    const content = readFileSync(pagePath, 'utf-8')
    expect(content).toContain('getSessionUniversal')
  })

  it('debería usar ProfileTabs', () => {
    const content = readFileSync(pagePath, 'utf-8')
    expect(content).toContain('ProfileTabs')
  })
})
