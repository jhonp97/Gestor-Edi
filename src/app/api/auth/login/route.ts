import { NextResponse } from 'next/server'
import { authService, AuthError } from '@/services/auth.service'
import { loginSchema } from '@/schemas/auth.schema'
import { rateLimit } from '@/lib/rate-limit'
import { AUTH_RATE_LIMIT } from '@/config/rate-limits'

// Helper function to extract IP from request
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    ?? request.headers.get('x-real-ip') 
    ?? 'unknown'
}

export async function POST(request: Request) {
  // Rate limiting BEFORE auth (use IP since user not authenticated)
  const ip = getClientIp(request)
  const { success, remaining, resetAt } = rateLimit(`auth:login:${ip}`, AUTH_RATE_LIMIT)
  
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
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    // Login
    const result = await authService.login(email, password)
   

    // Create response with cookie
    const response = NextResponse.json({ success: true, user: result.user }, { headers: rateLimitHeaders })

    response.cookies.set('auth-token', result.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (error) {
    if (error instanceof AuthError) {
      // Determine which field the error applies to
      if (error.code === 'EMAIL_NOT_FOUND' || error.code === 'EMAIL_EXISTS') {
        return NextResponse.json({ 
          error: error.message, 
          field: 'email' 
        }, { status: 401 })
      }
      if (error.code === 'INVALID_PASSWORD' || error.code === 'WRONG_PASSWORD') {
        return NextResponse.json({ 
          error: error.message, 
          field: 'password' 
        }, { status: 401 })
      }
      // Generic credentials error
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
