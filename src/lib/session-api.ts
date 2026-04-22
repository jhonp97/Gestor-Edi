import { auth } from '@/lib/auth'
import { authService } from '@/services/auth.service'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'auth-token'

/**
 * Universal session getter for API routes.
 * Supports BOTH authentication systems:
 * 1. NextAuth (Google OAuth)
 * 2. Custom JWT (email/password)
 * 
 * Use this in ALL API routes instead of calling auth() directly.
 */
export async function getSessionFromRequest(request: NextRequest) {
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
    const token = request.cookies.get(COOKIE_NAME)?.value

    if (!token) {
      return null
    }

    const session = await authService.getSession(token)
    return session
  } catch {
    return null
  }
}
