import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getSessionUniversal } from '@/lib/session'
import { GlobalFleetReportTooLargeError, InvalidGlobalFleetSelectionError, loadFleetGlobalReport, validateGlobalFleetSelection } from '@/lib/fleet-global-report'
import { resolveReportPeriod } from '@/lib/truck-monthly-report'
import { FleetGlobalDocument } from '@/lib/pdf/fleet-global-document'
import type { FleetGlobalPeriod } from '@/lib/fleet-global-report-types'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: NextRequest) {
  const session = await getSessionUniversal()
  if (!session?.user?.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers })
  const params = request.nextUrl.searchParams
  let month: string
  let period: FleetGlobalPeriod
  const truckIds = params.getAll('truck')
  try {
    if (params.getAll('month').length !== 1 || params.getAll('period').length > 1) throw new Error('Invalid parameters')
    month = params.get('month') ?? ''
    period = resolveReportPeriod(params.get('period') ?? undefined)
    validateGlobalFleetSelection(truckIds, month, period)
  } catch {
    return NextResponse.json({ error: 'Selección global no válida' }, { status: 400, headers })
  }
  // Ignore web cursors: this report always covers the entire selected period.
  try {
    const report = await loadFleetGlobalReport(session.user.organizationId, truckIds, month, period)
    const buffer = await renderToBuffer(<FleetGlobalDocument report={report} />)
    return new NextResponse(Buffer.from(buffer), { headers: { ...headers,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="informe-global-camiones-${month}.pdf"`,
    } })
  } catch (error) {
    if (error instanceof InvalidGlobalFleetSelectionError) return NextResponse.json({ error: 'Selección de camiones no encontrada' }, { status: 404, headers })
    if (error instanceof GlobalFleetReportTooLargeError) return NextResponse.json({ error: 'Informe demasiado grande; seleccioná menos camiones o un período menor' }, { status: 413, headers })
    return NextResponse.json({ error: 'No se pudo generar el informe' }, { status: 500, headers })
  }
}
