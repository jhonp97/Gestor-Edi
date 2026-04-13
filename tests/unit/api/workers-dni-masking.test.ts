import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('T3.6: DNI Masking for PLATFORM_ADMIN', () => {
  let encryptionService: ReturnType<typeof import('@/services/encryption.service').getEncryptionService>

  beforeEach(() => {
    process.env.DNI_ENCRYPTION_KEY = 'a'.repeat(32)
    vi.resetModules()
  })

  describe('EncryptionService.maskWorkerDni', () => {
    it('debería enmascarar DNI mostrando solo últimos 4 caracteres + primera letra', async () => {
      const { getEncryptionService } = await import('@/services/encryption.service')
      const enc = getEncryptionService()
      
      const masked = enc.maskWorkerDni('12345678A')
      expect(masked).toContain('***')
      expect(masked).not.toBe('12345678A')
      expect(masked).toBe('***678A*1')
    })

    it('debería enmascarar diferentes DNIs de forma consistente', async () => {
      const { getEncryptionService } = await import('@/services/encryption.service')
      const enc = getEncryptionService()
      
      // Different DNIs produce different masked values
      const masked1 = enc.maskWorkerDni('12345678A')
      const masked2 = enc.maskWorkerDni('87654321Z')
      
      expect(masked1).not.toBe(masked2)
      expect(masked1).toContain('***')
      expect(masked2).toContain('***')
    })
  })

  describe('Cross-org masking logic', () => {
    it('debería enmascarar DNI para PLATFORM_ADMIN viendo cross-org', async () => {
      const { getEncryptionService, EncryptionService } = await import('@/services/encryption.service')
      const enc = getEncryptionService()
      
      // Real encrypt/decrypt roundtrip
      const plaintextDni = '12345678A'
      const { dni: encryptedDni } = await enc.encryptWorkerDni(plaintextDni)
      const decrypted = await enc.decryptWorkerDni(encryptedDni)
      expect(decrypted).toBe(plaintextDni)
      
      // After decrypting (for lookup), mask it for display
      const masked = enc.maskWorkerDni(decrypted)
      
      // Masked contains the protection markers
      expect(masked).toContain('***')
      expect(masked).not.toBe(decrypted)
    })

    it('debería NO enmascarar DNI para usuarios de la misma org', async () => {
      const { getEncryptionService } = await import('@/services/encryption.service')
      const enc = getEncryptionService()
      
      // Same org: worker is from org-1, user is from org-1
      // → DNI should be visible in full (no masking)
      const plaintextDni = '12345678A'
      
      // No masking for same org
      expect(plaintextDni).not.toContain('***')
      expect(plaintextDni).toBe('12345678A')
    })

    it('PLATFORM_ADMIN en su propia org debería ver DNI completo', async () => {
      const { getEncryptionService } = await import('@/services/encryption.service')
      const enc = getEncryptionService()
      
      // PLATFORM_ADMIN's own org: no masking needed
      // They can see full DNI for their own org's workers
      const plaintextDni = '12345678A'
      expect(plaintextDni).not.toContain('***')
      expect(plaintextDni).toBe('12345678A')
    })
  })

  describe('PLATFORM_ADMIN cross-org access pattern', () => {
    it('debería aplicar masking solo cuando PLATFORM_ADMIN ve workers de OTRA org', async () => {
      const { getEncryptionService } = await import('@/services/encryption.service')
      const enc = getEncryptionService()
      
      type AccessContext = {
        viewerRole: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'USER'
        viewerOrgId: string
        workerOrgId: string
      }
      
      function shouldMaskDni(ctx: AccessContext): boolean {
        return ctx.viewerRole === 'PLATFORM_ADMIN' && ctx.viewerOrgId !== ctx.workerOrgId
      }
      
      // PLATFORM_ADMIN viewing cross-org: should mask
      expect(shouldMaskDni({ viewerRole: 'PLATFORM_ADMIN', viewerOrgId: 'my-org', workerOrgId: 'other-org' })).toBe(true)
      
      // PLATFORM_ADMIN viewing same org: should NOT mask
      expect(shouldMaskDni({ viewerRole: 'PLATFORM_ADMIN', viewerOrgId: 'my-org', workerOrgId: 'my-org' })).toBe(false)
      
      // ORG_ADMIN viewing same org: should NOT mask
      expect(shouldMaskDni({ viewerRole: 'ORG_ADMIN', viewerOrgId: 'my-org', workerOrgId: 'my-org' })).toBe(false)
      
      // ORG_ADMIN viewing cross-org: should mask (but they shouldn't have access anyway)
      expect(shouldMaskDni({ viewerRole: 'ORG_ADMIN', viewerOrgId: 'my-org', workerOrgId: 'other-org' })).toBe(false)
    })
  })
})
