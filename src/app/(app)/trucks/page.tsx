import { prisma } from '@/lib/prisma'
import { getSessionUniversal } from '@/lib/session'
import { redirect } from 'next/navigation'
import { TruckCard } from '@/components/trucks/truck-card'
import { TruckForm } from '@/components/trucks/truck-form'

// Force dynamic rendering to avoid build-time database connection
export const dynamic = 'force-dynamic'

export default async function TrucksPage() {
  const session = await getSessionUniversal()
  if (!session?.user?.organizationId) redirect('/login')
  const orgId = session.user.organizationId

  const [trucks, transactions] = await Promise.all([
    prisma.truck.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transaction.findMany({
      where: { organizationId: orgId },
      select: {
        truckId: true,
        type: true,
        amount: true,
      },
    }),
  ])

  // Calculate stats per truck
  const statsByTruckId = new Map<string, { income: number; expense: number }>()
  
  transactions.forEach((t) => {
    const current = statsByTruckId.get(t.truckId) || { income: 0, expense: 0 }
    if (t.type === 'INCOME') {
      current.income += t.amount
    } else {
      current.expense += t.amount
    }
    statsByTruckId.set(t.truckId, current)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Camiones</h1>
          <p className="text-lg text-muted-foreground">
            Gestión de la flota de camiones
          </p>
        </div>
        <TruckForm />
      </div>

      {trucks.length === 0 ? (
        <p className="text-lg text-muted-foreground">
          No hay camiones registrados. Agregá el primero usando el botón de
          arriba.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trucks.map((truck) => (
            <TruckCard 
              key={truck.id} 
              truck={truck} 
              stats={statsByTruckId.get(truck.id) || { income: 0, expense: 0 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
