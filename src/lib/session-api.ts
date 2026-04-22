import { auth } from '@/lib/auth'
import { authService } from '@/services/auth.service'

const COOKIE_NAME = 'auth-token'

/**
 * Universal session getter for API routes.
 * Supports BOTH authentication systems:
 * 1. NextAuth (Google OAuth)
 * 2. Custom JWT (email/password)
 * 
 * Use this in ALL API routes instead of calling auth() directly.
 */
export async function getSessionFromRequest(request: Request) {
  // 1. Try NextAuth session first (Google OAuth)
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
    const cookieHeader = request.headers.get('cookie')
    const token = cookieHeader
      ?.split('; ')
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.split('=')[1]

    if (!token) {
      return null
    }

    const session = await authService.getSession(token)
    return session
  } catch {
    return null
  }
}
