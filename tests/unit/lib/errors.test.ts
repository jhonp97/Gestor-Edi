import { describe, it, expect } from 'vitest'
import { ProfileError, TwoFactorError } from '@/lib/errors'

describe('Custom Errors', () => {
  it('ProfileError debería tener nombre ProfileError', () => {
    const err = new ProfileError('test')
    expect(err.name).toBe('ProfileError')
    expect(err.message).toBe('test')
  })

  it('TwoFactorError debería tener nombre TwoFactorError', () => {
    const err = new TwoFactorError('test')
    expect(err.name).toBe('TwoFactorError')
    expect(err.message).toBe('test')
  })
})
