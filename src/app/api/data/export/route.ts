import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dataExportService } from '@/services/data-export.service'
import { auditService } from '@/services/audit.service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const userRole = session.user.role
    const userOrgId = session.user.organizationId

    // Only ORG_ADMIN and PLATFORM_ADMIN can export data
    if (userRole !== 'ORG_ADMIN' && userRole !== 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado para exportar datos' },
        { status: 403 }
      )
    }

    if (!userOrgId) {
      return NextResponse.json(
        { error: 'Organización no encontrada' },
        { status: 400 }
      )
    }

    // Get format from query params
    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') || 'json') as 'json' | 'csv'

    // Generate the export
    const exportData = await dataExportService.generateExport(userOrgId, format)

    // Log the audit entry
    await auditService.log(
      'DATA_EXPORT',
      userId,
      userOrgId,
      { format },
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      request.headers.get('user-agent') || undefined
    )

    // Return as downloadable file
    const jsonContent = JSON.stringify(exportData, null, 2)
    const filename = `export-data-${userOrgId}-${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Data export POST error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
