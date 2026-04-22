import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { authService } from '@/services/auth.service'

const COOKIE_NAME = 'auth-token'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Try NextAuth session first (Google OAuth)
    const nextAuthSession = await auth()
    if (nextAuthSession?.user) {
      return NextResponse.json({
        user: {
          id: nextAuthSession.user.id,
          name: nextAuthSession.user.name,
          email: nextAuthSession.user.email,
          role: nextAuthSession.user.role,
          organizationId: nextAuthSession.user.organizationId,
          image: nextAuthSession.user.image,
        },
      })
    }

    // Fall back to custom JWT auth
    const cookie = request.headers.get('cookie')
    const token = cookie
      ?.split('; ')
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.split('=')[1]

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const session = await authService.getSession(token)

    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json(session)
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
