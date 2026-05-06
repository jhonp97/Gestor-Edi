import { prisma } from '@/lib/prisma'
import { getSessionUniversal } from '@/lib/session'
import { notFound, redirect } from 'next/navigation'
import { WorkerEditForm } from '@/components/workers/worker-edit-form'
import { decryptWorkerDni } from '@/lib/worker-utils'

export default async function WorkerEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getSessionUniversal()
  if (!session?.user?.organizationId) redirect('/login')
  const orgId = session.user.organizationId

  const rawWorker = await prisma.worker.findFirst({
    where: { id, organizationId: orgId },
  })

  if (!rawWorker) notFound()

  // Decrypt DNI for the edit form
  const decryptedDni = await decryptWorkerDni(rawWorker.dni)
  const worker = {
    ...rawWorker,
    dni: decryptedDni,
  }

  const trucks = await prisma.truck.findMany({
    where: { organizationId: orgId },
    orderBy: { brand: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Editar Trabajador
        </h1>
        <p className="text-lg text-muted-foreground">
          Modificá los datos de {worker.name}
        </p>
      </div>

      <WorkerEditForm worker={worker} trucks={trucks} />
    </div>
  )
}
