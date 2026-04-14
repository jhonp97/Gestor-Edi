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
    })
  } catch (error) {
    console.error('Admin orgs error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
