import { describe, it, expect, vi, beforeEach } from 'vitest'

// We'll test both the utility functions and the service class
// The utilities don't need env vars for basic crypto, but the service needs the key

describe('EncryptionService', () => {
  describe('Utility Functions (src/lib/encryption.ts)', () => {
    // Dynamic import to get functions - we'll use vi.mock for env
    it('debería encrypt y decrypt con roundtrip correcto', async () => {
      // Set up env var before import
      process.env.DNI_ENCRYPTION_KEY = 'a'.repeat(32) // 32 bytes for AES-256
      
      // Clear module cache to pick up env
      vi.resetModules()
      
      const { encrypt, decrypt } = await import('@/lib/encryption')
      
      const plaintext = '12345678A'
      const ciphertext = encrypt(plaintext)
      
      // Ciphertext should be different from plaintext
      expect(ciphertext).not.toBe(plaintext)
      // Ciphertext should contain a colon (iv:ciphertext format)
      expect(ciphertext).toContain(':')
      
      const decrypted = decrypt(ciphertext)
      expect(decrypted).toBe(plaintext)
    })

    it('debería manejar null/empty input gracefully', async () => {
      vi.resetModules()
      process.env.DNI_ENCRYPTION_KEY = 'a'.repeat(32)
      
      const { encrypt, decrypt, hash } = await import('@/lib/encryption')
      
      expect(encrypt('')).toBe('')
      expect(encrypt(null as unknown as string)).toBe('')
      expect(decrypt('')).toBe('')
      expect(decrypt(null as unknown as string)).toBe('')
      expect(hash('')).toBe('')
    })

    it('debería producir hashes SHA-256 consistentes', async () => {
      vi.resetModules()
      
      const { hash } = await import('@/lib/encryption')
      
      const dni1 = '12345678A'
      const dni2 = '12345678A'
      const dni3 = '87654321B'
      
      const hash1 = hash(dni1)
      const hash2 = hash(dni2)
      const hash3 = hash(dni3)
      
      // Same input → same hash
      expect(hash1).toBe(hash2)
      // Different input → different hash
      expect(hash1).not.toBe(hash3)
      // SHA-256 produces 64 hex characters
      expect(hash1).toHaveLength(64)
      expect(hash3).toHaveLength(64)
    })

    it('debería mask DNI correctamente', async () => {
      vi.resetModules()
      
      const { maskDni } = await import('@/lib/encryption')
      
      // Standard 9-char DNI: show last 4 + first letter
      expect(maskDni('12345678A')).toBe('***678A*1')
      // 8-char variant
      expect(maskDni('X1234567A')).toBe('***567A*X')
      // DNI with different last 4 chars
      expect(maskDni('87654321Z')).toBe('***321Z*8')
      // Very short — less than 5 chars shows everything masked
      expect(maskDni('123A')).toBe('***123A*1')
    })

    it('debería encrypt diferentes plaintexts a diferentes ciphertexts (IV randomness)', async () => {
      vi.resetModules()
      process.env.DNI_ENCRYPTION_KEY = 'b'.repeat(32)
      
      const { encrypt } = await import('@/lib/encryption')
      
      const plaintext = '12345678A'
      const ct1 = encrypt(plaintext)
      const ct2 = encrypt(plaintext)
      
      // Same plaintext should produce different ciphertext (different IVs)
      expect(ct1).not.toBe(ct2)
      // But both should decrypt to the same plaintext
      const { decrypt } = await import('@/lib/encryption')
      expect(decrypt(ct1)).toBe(plaintext)
      expect(decrypt(ct2)).toBe(plaintext)
    })
  })

  describe('EncryptionService class (src/services/encryption.service.ts)', () => {
    beforeEach(() => {
      process.env.DNI_ENCRYPTION_KEY = 'c'.repeat(32)
      vi.resetModules()
    })

    it('debería encryptWorkerDni retornar dni encriptado y hash', async () => {
      const { EncryptionService } = await import('@/services/encryption.service')
      const service = new EncryptionService()
      
      const result = await service.encryptWorkerDni('12345678A')
      
      expect(result.dni).not.toBe('12345678A')
      expect(result.dni).toContain(':') // iv:ciphertext format
      expect(result.dniHash).toHaveLength(64) // SHA-256
      expect(result.dniHash).not.toBe('')
    })

    it('debería decryptWorkerDni retornar plaintext', async () => {
      const { EncryptionService } = await import('@/services/encryption.service')
      const service = new EncryptionService()
      
      const { dni: encrypted } = await service.encryptWorkerDni('87654321B')
      const decrypted = await service.decryptWorkerDni(encrypted)
      
      expect(decrypted).toBe('87654321B')
    })

    it('debería maskWorkerDni retornar masked DNI', async () => {
      const { EncryptionService } = await import('@/services/encryption.service')
      const service = new EncryptionService()
      
      const masked = service.maskWorkerDni('12345678A')
      expect(masked).toBe('***678A*1')
    })

    it('debería hashWorkerDni retornar SHA-256 hash', async () => {
      const { EncryptionService } = await import('@/services/encryption.service')
      const service = new EncryptionService()
      
      const h1 = service.hashWorkerDni('12345678A')
      const h2 = service.hashWorkerDni('12345678A')
      const h3 = service.hashWorkerDni('87654321B')
      
      expect(h1).toBe(h2)
      expect(h1).not.toBe(h3)
      expect(h1).toHaveLength(64)
    })
  })
})
