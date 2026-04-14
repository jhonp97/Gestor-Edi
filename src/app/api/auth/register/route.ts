import { NextResponse } from 'next/server'
import { authService, AuthError } from '@/services/auth.service'
import { registerSchema } from '@/schemas/auth.schema'
import { rateLimit } from '@/lib/rate-limit'
import { AUTH_RATE_LIMIT } from '@/config/rate-limits'

const COOKIE_NAME = 'auth-token'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 8 * 60 * 60, // 8 hours in seconds
}

// Helper function to extract IP from request
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    ?? request.headers.get('x-real-ip') 
    ?? 'unknown'
}

export async function POST(request: Request) {
  // Rate limiting BEFORE auth (use IP since user not authenticated)
  const ip = getClientIp(request)
  const { success, remaining, resetAt } = rateLimit(`auth:register:${ip}`, AUTH_RATE_LIMIT)
  
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(AUTH_RATE_LIMIT.maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  }

  if (!success) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { 
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Retry-After': String(retryAfter),
        }
      }
    )
  }

  try {
    const body = await request.json()

    // Validate input
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { name, email, password } = parsed.data

    // Register user
    const result = await authService.register(name, email, password)

    // Create response with cookie
    const response = NextResponse.json(
      { user: result.user },
      { status: 201, headers: rateLimitHeaders }
    )

    response.cookies.set(COOKIE_NAME, result.token, COOKIE_OPTIONS)

    return response
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
