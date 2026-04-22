import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session-api'
import { profileService } from '@/services/profile.service'
import { auditService } from '@/services/audit.service'
import { changePasswordSchema } from '@/schemas/profile.schema'
import { rateLimit } from '@/lib/rate-limit'
import { AUTH_RATE_LIMIT } from '@/config/rate-limits'
import { ProfileError } from '@/lib/errors'

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
    const { success, remaining, resetAt } = rateLimit(`profile:password:${session.user.id}:${ip}`, AUTH_RATE_LIMIT)

    const rateLimitHeaders = {
      'X-RateLimit-Limit': String(AUTH_RATE_LIMIT.maxRequests),
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
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400, headers: rateLimitHeaders })
    }

    await profileService.changePassword(session.user.id, parsed.data.currentPassword, parsed.data.newPassword)

    await auditService.log(
      'PASSWORD_CHANGE',
      session.user.id,
      session.user.organizationId ?? null,
      {},
      ip,
      request.headers.get('user-agent') || undefined
    )

    return NextResponse.json({ success: true }, { headers: rateLimitHeaders })
  } catch (error) {
    if (error instanceof ProfileError) {
      const status = error.message.includes('Google') ? 403 : 401
      return NextResponse.json({ error: error.message }, { status })
    }
    console.error('Password change error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
