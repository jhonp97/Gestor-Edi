import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { auth } from '@/lib/auth'
import type { AuthTokenPayload } from '@/types/auth'

const COOKIE_NAME = 'auth-token'

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/offline',
  '/api/health',
]

const ADMIN_ROUTES = ['/admin']

function isPublicRoute(pathname: string): boolean {
  if (pathname.match(/\.(json|png|jpg|ico|svg|webp|txt|xml|js)$/)) return true
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith('/api/auth/')
  )
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => pathname.startsWith(route))
}

async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
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

function setSecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
  )
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl

  const response = NextResponse.next()
  setSecurityHeaders(response)

  // Dev mode: only check x-auth-token header for context, skip auth enforcement
  if (process.env.NODE_ENV !== 'production') {
    const authHeader = req.headers.get('x-auth-token')
    if (authHeader) {
      const payload = await verifyToken(authHeader)
      if (payload) {
        response.headers.set('x-user-id', payload.userId)
        response.headers.set('x-user-email', payload.email)
        response.headers.set('x-user-role', payload.role)
      }
    }
    return response
  }

  // Public routes always accessible
  if (isPublicRoute(pathname)) {
    return response
  }

  // Check NextAuth session first (Google OAuth, future Credentials)
  if (req.auth) {
    const user = req.auth.user
    response.headers.set('x-user-id', user?.id || '')
    response.headers.set('x-user-email', user?.email || '')
    response.headers.set('x-user-role', user?.role || 'USER')

    // Admin route check
    if (isAdminRoute(pathname) && user?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return response
  }

  // Fallback: check custom JWT auth-token cookie (email/password login)
  let token = req.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    const authHeader = req.headers.get('x-auth-token')
    if (authHeader) token = authHeader
  }

  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifyToken(token)

  if (!payload) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAdminRoute(pathname) && payload.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  response.headers.set('x-user-id', payload.userId)
  response.headers.set('x-user-email', payload.email)
  response.headers.set('x-user-role', payload.role)

  return response
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox|offline).*)',
  ],
}