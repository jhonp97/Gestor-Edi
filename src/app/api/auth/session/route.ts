import { NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'

const COOKIE_NAME = 'auth-token'

export async function GET(request: Request) {
  try {
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
