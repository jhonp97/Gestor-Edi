import { NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
import { forgotPasswordSchema } from '@/schemas/auth.schema'
import { rateLimit } from '@/lib/rate-limit'
import { AUTH_RATE_LIMIT } from '@/config/rate-limits'

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
}

export async function POST(request: Request) {
  // Rate limiting to prevent email enumeration and spam
  const ip = getClientIp(request)
  const { success, remaining, resetAt } = rateLimit(`auth:forgot-password:${ip}`, AUTH_RATE_LIMIT)

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
    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    await authService.requestPasswordReset(parsed.data.email)

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña',
    }, { headers: rateLimitHeaders })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500, headers: rateLimitHeaders })
  }
}
