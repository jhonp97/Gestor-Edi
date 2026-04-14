import { NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
import { getUserFromRequest } from '@/lib/auth-edge'
import { rateLimit } from '@/lib/rate-limit'
import { ADMIN_RATE_LIMIT } from '@/config/rate-limits'

export async function GET(request: Request) {
  // Rate limiting BEFORE auth check
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    ?? request.headers.get('x-real-ip') 
    ?? 'unknown'
  const { success, remaining, resetAt } = rateLimit(`admin:users:${ip}`, ADMIN_RATE_LIMIT)
  
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(ADMIN_RATE_LIMIT.maxRequests),
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
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const users = await authService.getAllUsers()
    return NextResponse.json({ users }, { headers: rateLimitHeaders })
  } catch (error) {
    console.error('Admin get users error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}