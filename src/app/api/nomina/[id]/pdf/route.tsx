import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { NominaDocument } from '@/lib/pdf/nomina-document'
import { PayrollService } from '@/services/payroll.service'
import { PayrollRepository } from '@/repositories/payroll.repository'
import { WorkerRepository } from '@/repositories/worker.repository'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = new PayrollService(new PayrollRepository(), new WorkerRepository())
  const payroll = await service.getById(id)
  
  if (!payroll) {
    return NextResponse.json({ error: 'Nómina no encontrada' }, { status: 404 })
  }

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
