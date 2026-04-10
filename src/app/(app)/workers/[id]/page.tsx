import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteWorkerButton } from '@/components/workers/delete-worker-button'
import { ArrowLeft, Truck } from 'lucide-react'
import { PayrollIndividualDialog } from '@/components/nomina/payroll-individual-dialog'

const statusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ON_LEAVE: 'Licencia',
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  ON_LEAVE: 'secondary',
  INACTIVE: 'destructive',
}

export default async function WorkerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const worker = await prisma.worker.findUnique({
    where: { id },
    include: { truck: true },
  })

  if (!worker) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/workers">
          <Button variant="outline" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{worker.name}</h1>
          <p className="text-lg text-muted-foreground">
            Detalle del trabajador
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="text-lg font-medium">{worker.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">DNI</p>
              <p className="text-lg font-mono">{worker.dni}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Puesto</p>
              <p className="text-lg">{worker.position}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge variant={statusVariant[worker.status] ?? 'secondary'}>
                {statusLabels[worker.status] ?? worker.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Información Laboral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Salario Base</p>
              <p className="text-lg font-medium">
                ${worker.baseSalary.toLocaleString('es-AR')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha de Inicio</p>
              <p className="text-lg">
                {new Date(worker.startDate).toLocaleDateString('es-AR')}
              </p>
            </div>
            {worker.endDate && (
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Fin</p>
                <p className="text-lg">
                  {new Date(worker.endDate).toLocaleDateString('es-AR')}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Camión Asignado</p>
              {worker.truck ? (
                <div className="flex items-center gap-2">
                  <Truck className="size-4 text-muted-foreground" />
                  <span>
                    {worker.truck.brand} {worker.truck.model} ({worker.truck.plate})
                  </span>
                </div>
              ) : (
                <p className="text-muted-foreground">Sin asignar</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payrolls placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Nóminas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Las nóminas se mostrarán aquí cuando estén disponibles.
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Link href={`/workers/${worker.id}/edit`}>
          <Button>Editar Trabajador</Button>
        </Link>
        <PayrollIndividualDialog preselectedWorker={worker} />
        <DeleteWorkerButton workerId={worker.id} workerName={worker.name} />
      </div>
    </div>
  )
}
