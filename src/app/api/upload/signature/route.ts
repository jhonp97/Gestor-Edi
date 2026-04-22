import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session-api'
import { cloudinaryUploadService } from '@/services/cloudinary-upload.service'
import { rateLimit } from '@/lib/rate-limit'
import { UPLOAD_RATE_LIMIT } from '@/config/rate-limits'

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
    const { success, remaining, resetAt } = rateLimit(`upload:signature:${session.user.id}:${ip}`, UPLOAD_RATE_LIMIT)

    const rateLimitHeaders = {
      'X-RateLimit-Limit': String(UPLOAD_RATE_LIMIT.maxRequests),
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

    const body = await request.json().catch(() => ({}))
    const folder = typeof body.folder === 'string' ? body.folder : 'profiles'

    const signed = cloudinaryUploadService.generateSignature(folder)

    return NextResponse.json(signed, { headers: rateLimitHeaders })
  } catch (error) {
    console.error('Upload signature error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
