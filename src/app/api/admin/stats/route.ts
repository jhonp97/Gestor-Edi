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
  const { success, remaining, resetAt } = rateLimit(`admin:stats:${ip}`, ADMIN_RATE_LIMIT)
  
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

    const stats = await adminService.getPlatformStats()

    return NextResponse.json({
      users: stats.users,
      orgs: stats.orgs,
      workers: stats.workers,
      trucks: stats.trucks,
      transactions: stats.transactions,
      consentStats: stats.consentStats,
      pendingDeletions: stats.pendingDeletions,
      recentAuditLogs: stats.recentAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        userId: log.userId,
        details: log.details,
      })),
    }, { headers: rateLimitHeaders })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
