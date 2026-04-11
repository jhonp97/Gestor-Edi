import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TruckEditDialog } from '@/components/trucks/truck-edit-dialog'
import { TruckDeleteButton } from '@/components/trucks/truck-delete-button'
import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'

export const dynamic = 'force-dynamic'

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

const workerStatusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ON_LEAVE: 'Licencia',
}

export default async function TruckDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string; sort?: string }>
}) {
  const { id } = await params
  const { type, sort } = await searchParams

  const truck = await prisma.truck.findUnique({
    where: { id },
    include: {
      workers: {
        orderBy: { name: 'asc' },
      },
      transactions: {
        where: type === 'INCOME' || type === 'EXPENSE' ? { type } : undefined,
        orderBy: { date: sort === 'asc' ? 'asc' : 'desc' },
      },
    },
  })

  if (!truck) notFound()

  const totalIncome = truck.transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + t.amount, 0)

  const totalExpense = truck.transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/trucks">
            <button className="flex size-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent">
              <ArrowLeft className="size-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {truck.brand} {truck.model} ({truck.year})
            </h1>
            <div className="mt-1 flex items-center gap-3">
              <Badge variant={statusVariant[truck.status] ?? 'secondary'}>
                {statusLabels[truck.status] ?? truck.status}
              </Badge>
              <span className="font-mono text-muted-foreground">{truck.plate}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <TruckEditDialog truck={truck} />
          <TruckDeleteButton truckId={truck.id} truckName={`${truck.brand} ${truck.model}`} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Ingresos totales</p>
            <p className="text-2xl font-bold text-green-600">
              €{totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Gastos totales</p>
            <p className="text-2xl font-bold text-red-600">
              €{totalExpense.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Balance</p>
            <p className={`text-2xl font-bold ${(totalIncome - totalExpense) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              €{(totalIncome - totalExpense).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trabajadores asignados */}
      {truck.workers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              Trabajadores Asignados ({truck.workers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {truck.workers.map((worker) => (
                <Link
                  key={worker.id}
                  href={`/workers/${worker.id}`}
                  className="flex items-center justify-between py-3 hover:text-primary transition-colors"
                >
                  <div>
                    <p className="font-medium">{worker.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {worker.position} · {worker.dni}
                    </p>
                  </div>
                  <Badge variant={worker.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {workerStatusLabels[worker.status] ?? worker.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transacciones con filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>
              Transacciones ({truck.transactions.length})
            </CardTitle>
            {/* Filtros */}
            <form className="flex items-center gap-2">
              <select
                name="type"
                defaultValue={type ?? ''}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Todos</option>
                <option value="INCOME">Solo ingresos</option>
                <option value="EXPENSE">Solo gastos</option>
              </select>
              <select
                name="sort"
                defaultValue={sort ?? 'desc'}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="desc">Más reciente</option>
                <option value="asc">Más antiguo</option>
              </select>
              <button
                type="submit"
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm hover:bg-accent"
              >
                Filtrar
              </button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {truck.transactions.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              No hay transacciones con los filtros seleccionados.
            </p>
          ) : (
            <div className="divide-y">
              {truck.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString('es-ES')}
                      {tx.category && ` · ${tx.category}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={tx.type === 'INCOME' ? 'default' : 'destructive'}>
                      {tx.type === 'INCOME' ? 'Ingreso' : 'Gasto'}
                    </Badge>
                    <span
                      className={`font-semibold ${
                        tx.type === 'INCOME'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {tx.type === 'INCOME' ? '+' : '-'}€{tx.amount.toFixed(2)}
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