import crypto from 'crypto'

/**
 * Encryption key for AES-256-CBC — must be exactly 32 bytes.
 * Set via DNI_ENCRYPTION_KEY environment variable.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.DNI_ENCRYPTION_KEY
  if (!key) {
    throw new Error('DNI_ENCRYPTION_KEY environment variable is not set')
  }
  if (key.length !== 32) {
    throw new Error(`DNI_ENCRYPTION_KEY must be exactly 32 bytes, got ${key.length}`)
  }
  return Buffer.from(key, 'utf8')
}

/**
 * Encrypt plaintext using AES-256-CBC.
 * Returns format: "iv:ciphertext" (both base64 encoded).
 * Returns empty string if input is null/empty.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext || plaintext.length === 0) return ''
  
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  
  return `${iv.toString('base64')}:${encrypted}`
}

/**
 * Decrypt ciphertext from AES-256-CBC encryption.
 * Input format: "iv:ciphertext" (both base64 encoded).
 * Returns empty string if input is null/empty.
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext || ciphertext.length === 0) return ''
  
  const key = getEncryptionKey()
  const [ivBase64, encryptedBase64] = ciphertext.split(':')
  
  if (!ivBase64 || !encryptedBase64) {
    throw new Error('Invalid ciphertext format — expected iv:ciphertext')
  }
  
  const iv = Buffer.from(ivBase64, 'base64')
  const encrypted = Buffer.from(encryptedBase64, 'base64')
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  
  return decrypted.toString('utf8')
}

/**
 * Produce SHA-256 hash of plaintext for use in dniHash lookups.
 * The hash is one-way — used for exact-match queries where we need
 * to find a record without exposing the plaintext DNI.
 * Returns empty string if input is null/empty.
 */
export function hash(plaintext: string): string {
  if (!plaintext || plaintext.length === 0) return ''
  
  return crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex')
}

/**
 * Mask a DNI for display purposes.
 * Shows last 4 characters and first letter, masks the rest.
 * "12345678A" → "***678A*1"
 */
export function maskDni(dni: string): string {
  if (!dni || dni.length === 0) return ''
  
  const last4 = dni.slice(-4)
  const firstLetter = dni[0] || ''
  
  return `***${last4}*${firstLetter}`
}
