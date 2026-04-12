import { NextResponse } from 'next/server'

const COOKIE_NAME = 'auth-token'
const NEXTAUTH_SESSION_COOKIE = 'session-token'

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Clear custom JWT cookie (email/password login)
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  })

  // Clear NextAuth session cookie (Google OAuth)
  response.cookies.set(NEXTAUTH_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  })

  return response
}
