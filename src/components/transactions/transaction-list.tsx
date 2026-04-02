'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { TransactionWithTruck } from '@/types'
import { Filter } from 'lucide-react'

interface TransactionListProps {
  transactions: TransactionWithTruck[]
}

export function TransactionList({ transactions }: TransactionListProps) {
  const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [search, setSearch] = useState('')

  const filtered = transactions.filter((tx) => {
    const matchesType = filter === 'ALL' || tx.type === filter
    const matchesSearch =
      search === '' ||
      tx.description.toLowerCase().includes(search.toLowerCase()) ||
      tx.truck.plate.toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesSearch
  })

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Lista de Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg text-muted-foreground">
            No hay transacciones registradas.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          Lista de Transacciones ({filtered.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por descripción o matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm text-lg"
            aria-label="Buscar transacciones"
          />
          <div className="flex gap-2" role="group" aria-label="Filtrar por tipo">
            <Button
              variant={filter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('ALL')}
            >
              <Filter className="mr-1 size-4" aria-hidden="true" />
              Todas
            </Button>
            <Button
              variant={filter === 'INCOME' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('INCOME')}
            >
              Ingresos
            </Button>
            <Button
              variant={filter === 'EXPENSE' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('EXPENSE')}
            >
              Gastos
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-lg text-muted-foreground">
            No se encontraron resultados.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-base font-medium">{tx.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {tx.truck.plate} —{' '}
                    {new Date(tx.date).toLocaleDateString('es-AR')}
                    {tx.category && ` — ${tx.category}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={tx.type === 'INCOME' ? 'default' : 'destructive'}
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
  )
}
