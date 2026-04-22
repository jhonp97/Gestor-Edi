import { auth } from '@/lib/auth'
import { authService } from '@/services/auth.service'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'auth-token'

/**
 * Universal session getter that supports BOTH authentication systems:
 * 1. NextAuth (Google OAuth)
 * 2. Custom JWT (email/password)
 * 
 * Use this in ALL Server Components instead of calling auth() directly.
 */
export async function getSessionUniversal() {
  // 1. Try NextAuth first (Google OAuth)
  const nextAuthSession = await auth()
  if (nextAuthSession?.user) {
    return {
      user: {
        id: nextAuthSession.user.id,
        name: nextAuthSession.user.name || '',
        email: nextAuthSession.user.email || '',
        role: nextAuthSession.user.role || 'USER',
        organizationId: nextAuthSession.user.organizationId,
        image: nextAuthSession.user.image,
      },
    }
  }

  // 2. Fall back to custom JWT auth-token cookie
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) {
      return null
    }

    const session = await authService.getSession(token)
    return session
  } catch {
    return null
  }
}
