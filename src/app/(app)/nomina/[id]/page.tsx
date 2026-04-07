import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PayrollBreakdown } from '@/components/nomina/payroll-breakdown'
import { MarkAsPaidButton } from '@/components/nomina/mark-as-paid-button'
import { ArrowLeft, Download } from 'lucide-react'

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default async function PayrollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: { worker: true },
  })

  if (!payroll) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/nomina">
            <Button variant="outline" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Nómina — {payroll.worker.name}
            </h1>
            <p className="text-lg text-muted-foreground">
              {MONTH_NAMES[payroll.month]} {payroll.year}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Download PDF */}
          <a href={`/api/nomina/${payroll.id}/pdf`} download>
            <Button variant="default">
              <Download className="mr-2 size-4" />
              Descargar PDF
            </Button>
          </a>
          {/* Mark as paid - Client Component */}
          {!payroll.paidAt && (
            <MarkAsPaidButton payrollId={payroll.id} workerName={payroll.worker.name} />
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <Badge variant={payroll.paidAt ? 'default' : 'secondary'} className="text-base px-4 py-1">
          {payroll.paidAt ? 'Pagado' : 'Pendiente'}
        </Badge>
        {payroll.paidAt && (
          <span className="text-sm text-muted-foreground">
            Pagado el {new Date(payroll.paidAt).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Worker Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Trabajador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="text-lg font-medium">{payroll.worker.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">DNI</p>
              <p className="text-lg font-mono">{payroll.worker.dni}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Puesto</p>
              <p className="text-lg">{payroll.worker.position}</p>
            </div>
          </CardContent>
        </Card>

        {/* Period Info */}
        <Card>
          <CardHeader>
            <CardTitle>Período</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Mes</p>
              <p className="text-lg">{MONTH_NAMES[payroll.month]}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Año</p>
              <p className="text-lg">{payroll.year}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Creada el</p>
              <p className="text-lg">
                {new Date(payroll.createdAt).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <PayrollBreakdown payroll={payroll} />

      {/* Notes */}
      {payroll.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{payroll.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
