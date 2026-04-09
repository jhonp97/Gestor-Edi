import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import type { AuthTokenPayload } from '@/types/auth'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production'
const COOKIE_NAME = 'auth-token'

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/offline',
  '/api/health',
]

// Routes that require ADMIN role
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

function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Security headers (always applied)
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
  )


  // In development we allow access but verify from header
  if (process.env.NODE_ENV !== 'production') {
    // In dev, just pass through but try to verify token if present
    const authHeader = request.headers.get('x-auth-token')
    if (authHeader) {
      const payload = verifyToken(authHeader)
      if (payload) {
        response.headers.set('x-user-id', payload.userId)
        response.headers.set('x-user-email', payload.email)
        response.headers.set('x-user-role', payload.role)
      }
    }
    return response
  }

  // Skip auth check for public routes
  if (isPublicRoute(pathname)) {
    return response
  }

  // Get token from cookie OR from custom header (for client-side auth)
  let token = request.cookies.get(COOKIE_NAME)?.value
  
  // If no cookie, check for token in header (set by client from localStorage)
  if (!token) {
    const authHeader = request.headers.get('x-auth-token')
    if (authHeader) {
      token = authHeader
    }
  }

  if (!token) {
    // Redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify token
  const payload = verifyToken(token)

  if (!payload) {
    // Token invalid, redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check admin routes
  if (isAdminRoute(pathname) && payload.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Add user info to headers for server components
  response.headers.set('x-user-id', payload.userId)
  response.headers.set('x-user-email', payload.email)
  response.headers.set('x-user-role', payload.role)

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox|offline).*)' 
  ],
}
