import { prisma } from '@/lib/prisma'
import { getSessionUniversal } from '@/lib/session'
import { redirect } from 'next/navigation'
import { WorkerTable } from '@/components/workers/worker-table'
import { WorkerForm } from '@/components/workers/worker-form'

// Force dynamic rendering to avoid build-time database connection
export const dynamic = 'force-dynamic'

export default async function WorkersPage() {
  const session = await getSessionUniversal()
  if (!session?.user?.organizationId) redirect('/login')
  const orgId = session.user.organizationId

  const [workers, trucks] = await Promise.all([
    prisma.worker.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.truck.findMany({
      where: { organizationId: orgId },
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
