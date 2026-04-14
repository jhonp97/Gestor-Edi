import { NextResponse } from 'next/server'
import { adminService } from '@/services/admin.service'
import { getUserFromRequest } from '@/lib/auth-edge'
import { rateLimit } from '@/lib/rate-limit'
import { ADMIN_RATE_LIMIT } from '@/config/rate-limits'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Rate limiting BEFORE auth check
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    ?? request.headers.get('x-real-ip') 
    ?? 'unknown'
  const { success, remaining, resetAt } = rateLimit(`admin:orgs:${ip}`, ADMIN_RATE_LIMIT)
  
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const orgs = await adminService.getOrgList({ page, limit })

    return NextResponse.json({
      data: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        planType: org.planType,
        planStatus: org.planStatus,
        memberCount: org.memberCount,
        truckCount: org.truckCount,
        workerCount: org.workerCount,
        transactionCount: org.transactionCount,
        createdAt: org.createdAt,
      })),
      pagination: {
        page,
        limit,
      },
    }, { headers: rateLimitHeaders })
  } catch (error) {
    console.error('Admin orgs error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
