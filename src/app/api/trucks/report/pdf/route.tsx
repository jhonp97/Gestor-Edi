import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getSessionUniversal } from '@/lib/session'
import { ExportTooLargeError, loadTruckMonthlyExport } from '@/lib/truck-monthly-export'
import { InvalidFleetSelectionError, resolveReportMonth } from '@/lib/truck-monthly-report'
import { TruckMonthlyDocument } from '@/lib/pdf/truck-monthly-document'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: NextRequest) {
  const session = await getSessionUniversal()
  if (!session?.user?.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers })
  const params = request.nextUrl.searchParams
  let month: string
  let truck: string
  try {
    for (const key of ['month', 'truck', 'period']) {
      if (params.getAll(key).length > 1) throw new Error('Repeated parameter')
    }
    if (!params.has('month')) throw new Error('Month required')
    month = resolveReportMonth(params.get('month') ?? '')
    truck = params.get('truck') ?? 'all'
    if (!truck || truck.length > 160 || !/^[\w-]+$/.test(truck)) throw new Error('Invalid truck')
    if (params.has('period') && params.get('period') !== 'month') throw new Error('Monthly only')
  } catch {
    return NextResponse.json({ error: 'Selección mensual no válida' }, { status: 400, headers })
  }
  // Web cursors are deliberately ignored: an export always covers the complete month.
  try {
    const report = await loadTruckMonthlyExport(session.user.organizationId, truck, month)
    const buffer = await renderToBuffer(<TruckMonthlyDocument report={report} />)
    return new NextResponse(Buffer.from(buffer), { headers: { ...headers,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="informe-camiones-${month}.pdf"`,
    } })
  } catch (error) {
    if (error instanceof InvalidFleetSelectionError) return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404, headers })
    if (error instanceof ExportTooLargeError) return NextResponse.json({ error: 'Informe demasiado grande; seleccioná un solo camión' }, { status: 413, headers })
    return NextResponse.json({ error: 'No se pudo generar el informe' }, { status: 500, headers })
  }
}
