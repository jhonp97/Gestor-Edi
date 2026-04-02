import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

const statusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  MAINTENANCE: 'En Mantenimiento',
  INACTIVE: 'Inactivo',
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  MAINTENANCE: 'secondary',
  INACTIVE: 'destructive',
}

export default async function TruckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const truck = await prisma.truck.findUnique({
    where: { id },
    include: {
      transactions: {
        orderBy: { date: 'desc' },
      },
    },
  })

  if (!truck) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/trucks"
          className="text-lg text-muted-foreground hover:text-foreground"
        >
          ← Volver a Camiones
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">
          {truck.brand} {truck.model} ({truck.year})
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <Badge variant={statusVariant[truck.status] ?? 'secondary'}>
            {statusLabels[truck.status] ?? truck.status}
          </Badge>
          <span className="text-lg font-mono text-muted-foreground">
            {truck.plate}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Transacciones ({truck.transactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {truck.transactions.length === 0 ? (
            <p className="text-lg text-muted-foreground">
              No hay transacciones para este camión.
            </p>
          ) : (
            <div className="space-y-3">
              {truck.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-base font-medium">{tx.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString('es-AR')}
                      {tx.category && ` — ${tx.category}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        tx.type === 'INCOME' ? 'default' : 'destructive'
                      }
                    >
                      {tx.type === 'INCOME' ? 'Ingreso' : 'Gasto'}
                    </Badge>
                    <span
                      className={
                        tx.type === 'INCOME'
                          ? 'text-lg font-semibold text-green-600 dark:text-green-400'
                          : 'text-lg font-semibold text-red-600 dark:text-red-400'
                      }
                    >
                      {tx.type === 'INCOME' ? '+' : '-'}$
                      {tx.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
