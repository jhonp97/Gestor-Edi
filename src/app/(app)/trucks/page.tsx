import { prisma } from '@/lib/prisma'
import { TruckCard } from '@/components/trucks/truck-card'
import { TruckForm } from '@/components/trucks/truck-form'

export default async function TrucksPage() {
  const trucks = await prisma.truck.findMany({
    orderBy: { createdAt: 'desc' },
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
            <TruckCard key={truck.id} truck={truck} />
          ))}
        </div>
      )}
    </div>
  )
}
