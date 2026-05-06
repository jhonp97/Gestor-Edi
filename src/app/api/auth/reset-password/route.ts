import { NextResponse } from 'next/server'
import { authService, AuthError } from '@/services/auth.service'
import { resetPasswordSchema } from '@/schemas/auth.schema'
import { rateLimit } from '@/lib/rate-limit'
import { AUTH_RATE_LIMIT } from '@/config/rate-limits'

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
}

export async function POST(request: Request) {
  // Rate limiting to prevent brute force of reset tokens
  const ip = getClientIp(request)
  const { success, remaining, resetAt } = rateLimit(`auth:reset-password:${ip}`, AUTH_RATE_LIMIT)

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
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    await authService.resetPassword(parsed.data.token, parsed.data.password)

    return NextResponse.json({ message: 'Contraseña actualizada exitosamente' }, { headers: rateLimitHeaders })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: rateLimitHeaders })
    }
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500, headers: rateLimitHeaders })
  }
}
