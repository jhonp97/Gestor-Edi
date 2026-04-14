import { NextResponse } from 'next/server'
import { adminService } from '@/services/admin.service'
import { getUserFromRequest } from '@/lib/auth-edge'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
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
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
