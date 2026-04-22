import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session-api'
import { twoFactorService } from '@/services/two-factor.service'
import { auditService } from '@/services/audit.service'
import { rateLimit } from '@/lib/rate-limit'
import { TWO_FA_RATE_LIMIT } from '@/config/rate-limits'
import { TwoFactorError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const { success, remaining, resetAt } = rateLimit(`2fa:verify:${session.user.id}:${ip}`, TWO_FA_RATE_LIMIT)

    const rateLimitHeaders = {
      'X-RateLimit-Limit': String(TWO_FA_RATE_LIMIT.maxRequests),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
    }

    if (!success) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { ...rateLimitHeaders, 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await request.json()
    if (!body.code || typeof body.code !== 'string') {
      return NextResponse.json({ error: 'Código requerido' }, { status: 400, headers: rateLimitHeaders })
    }

    const result = await twoFactorService.verifyCode(session.user.id, body.code)

    await auditService.log(
      'TWO_FACTOR_CHANGE',
      session.user.id,
      session.user.organizationId ?? null,
      { action: 'enabled' },
      ip,
      request.headers.get('user-agent') || undefined
    )

    return NextResponse.json(result, { headers: rateLimitHeaders })
  } catch (error) {
    if (error instanceof TwoFactorError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('2FA verify error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
