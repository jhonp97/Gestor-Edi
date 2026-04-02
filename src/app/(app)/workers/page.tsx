import { prisma } from '@/lib/prisma'
import { WorkerTable } from '@/components/workers/worker-table'
import { WorkerForm } from '@/components/workers/worker-form'

export default async function WorkersPage() {
  const [workers, trucks] = await Promise.all([
    prisma.worker.findMany({
      orderBy: { createdAt: 'desc' },
    }),
    prisma.truck.findMany({
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trabajadores</h1>
          <p className="text-lg text-muted-foreground">
            Gestión del personal de la flota
          </p>
        </div>
        <WorkerForm trucks={trucks} />
      </div>

      {workers.length === 0 ? (
        <p className="text-lg text-muted-foreground">
          No hay trabajadores registrados. Agregá el primero usando el botón de
          arriba.
        </p>
      ) : (
        <WorkerTable workers={workers} trucks={trucks} />
      )}
    </div>
  )
}
