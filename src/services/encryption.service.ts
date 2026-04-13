import { encrypt, decrypt, hash, maskDni } from '@/lib/encryption'

/**
 * EncryptionService wraps the low-level encryption utilities.
 * Use this service for all Worker DNI operations.
 */
export class EncryptionService {
  /**
   * Encrypt a plaintext DNI and produce its hash for lookups.
   * Returns both the encrypted DNI and the SHA-256 hash.
   */
  async encryptWorkerDni(dni: string): Promise<{ dni: string; dniHash: string }> {
    return {
      dni: encrypt(dni),
      dniHash: hash(dni),
    }
  }

  /**
   * Decrypt an encrypted DNI back to plaintext.
   */
  async decryptWorkerDni(ciphertext: string): Promise<string> {
    return decrypt(ciphertext)
  }

  /**
   * Hash a DNI for use in exact-match lookups.
   */
  hashWorkerDni(dni: string): string {
    return hash(dni)
  }

  /**
   * Mask a DNI for display (e.g., to platform admins viewing cross-org data).
   */
  maskWorkerDni(dni: string): string {
    return maskDni(dni)
  }
}

// Singleton instance
let _instance: EncryptionService | null = null

export function getEncryptionService(): EncryptionService {
  if (!_instance) {
    _instance = new EncryptionService()
  }
  return _instance
}
