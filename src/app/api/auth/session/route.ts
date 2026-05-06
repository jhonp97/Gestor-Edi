import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { authService } from '@/services/auth.service'
import { prisma } from '@/lib/prisma'

const COOKIE_NAME = 'auth-token'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Try NextAuth session first (Google OAuth)
    const nextAuthSession = await auth()
    if (nextAuthSession?.user?.id) {
      // Fetch fresh role from DB to avoid stale JWT data
      const dbUser = await prisma.user.findUnique({
        where: { id: nextAuthSession.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organizationId: true,
          image: true,
        },
      })
      if (dbUser) {
        return NextResponse.json({ user: dbUser })
      }
      // Fallback to JWT data if DB lookup fails
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
