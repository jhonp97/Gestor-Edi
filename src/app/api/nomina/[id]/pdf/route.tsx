import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { NominaDocument } from '@/lib/pdf/nomina-document'
import { PayrollService } from '@/services/payroll.service'
import { PayrollRepository } from '@/repositories/payroll.repository'
import { WorkerRepository } from '@/repositories/worker.repository'
import { getSessionUniversal } from '@/lib/session'
import { mapPayrollWorkerIdentity } from '@/lib/payroll-worker-identity'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUniversal()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const orgId = session.user.organizationId
  const service = new PayrollService(new PayrollRepository(orgId), new WorkerRepository(orgId))
  const storedPayroll = await service.getById(id)

  if (!storedPayroll) {
    return NextResponse.json({ error: 'Nómina no encontrada' }, { status: 404 })
  }

  const payroll = await mapPayrollWorkerIdentity(storedPayroll)
  const buffer = await renderToBuffer(
    <NominaDocument payroll={{
      ...payroll,
      paidAt: payroll.paidAt?.toISOString() ?? null,
    }} />
  )

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="nomina-${payroll.worker.name.replace(/\s/g, '_')}-${payroll.month}-${payroll.year}.pdf"`,
    },
  })
}
