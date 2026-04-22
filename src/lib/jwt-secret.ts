/**
 * JWT secret helper compatible with Edge Runtime.
 * Throws if NEXTAUTH_SECRET is missing — no fallback allowed.
 */
export function getJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET env var is required')
  }
  return secret
}
