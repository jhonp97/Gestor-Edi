import { auth } from '@/lib/auth'
import { jwtVerify } from 'jose'
import type { AuthTokenPayload } from '@/types/auth'

const COOKIE_NAME = 'auth-token'

/**
 * Get user from request — checks both auth systems:
 * 1. NextAuth session (Google OAuth, etc.)
 * 2. Custom JWT cookie (email/password login)
 * 3. x-auth-token header (offline/development)
 */
export async function getUserFromRequest(request: Request): Promise<AuthTokenPayload | null> {
  // 1. Try NextAuth session first
  try {
    const session = await auth()
    if (session?.user) {
      return {
        userId: session.user.id,
        email: session.user.email || '',
        role: session.user.role,
      }
    }
  } catch {
    // NextAuth session not available, try custom JWT
  }

  // 2. Try x-auth-token header (offline/development)
  const authHeader = request.headers.get('x-auth-token')
  if (authHeader) {
    const payload = await verifyJwt(authHeader)
    if (payload) return payload
  }

  // 3. Try custom auth-token cookie
  const cookie = request.headers.get('cookie')
  const token = cookie
    ?.split('; ')
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1]

  if (!token) return null

  return verifyJwt(token)
}

async function verifyJwt(token: string): Promise<AuthTokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production'
    )
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as AuthTokenPayload
  } catch {
    return null
  }
}