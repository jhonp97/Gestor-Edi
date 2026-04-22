import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session-api'
import { auditService } from '@/services/audit.service'
import { AuditLogQuerySchema } from '@/schemas/audit.schema'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const userRole = session.user.role
    const userOrgId = session.user.organizationId

    // Parse pagination params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const pagination = AuditLogQuerySchema.parse({ page, limit })

    let logs

    if (userRole === 'PLATFORM_ADMIN') {
      // PLATFORM_ADMIN can see all audit logs
      logs = await auditService.getAll(pagination)
    } else if (userRole === 'ORG_ADMIN') {
      // ORG_ADMIN can only see logs for their organization
      if (!userOrgId) {
        return NextResponse.json(
          { error: 'Organización no encontrada' },
          { status: 400 }
        )
      }
      logs = await auditService.getByOrg(userOrgId, pagination)
    } else {
      // Regular users cannot access audit logs
      return NextResponse.json(
        { error: 'No autorizado para ver logs de auditoría' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      data: logs,
      pagination: {
        page,
        limit,
      },
    })
  } catch (error) {
    console.error('Audit GET error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
