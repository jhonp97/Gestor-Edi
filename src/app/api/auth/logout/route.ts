import { NextResponse } from 'next/server'

const COOKIE_NAME = 'auth-token'
const NEXTAUTH_SESSION_COOKIE = 'authjs.session-token'
const NEXTAUTH_LEGACY_COOKIE = 'next-auth.session-token'
const NEXTAUTH_CSRF_COOKIE = 'authjs.csrf-token'

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

  // Clear NextAuth session cookies (Google OAuth) — try both naming conventions
  response.cookies.set(NEXTAUTH_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  })
  response.cookies.set(NEXTAUTH_LEGACY_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  })
  response.cookies.set(NEXTAUTH_CSRF_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  })

  return response
}
