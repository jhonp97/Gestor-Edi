import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TransactionWithTruck } from '@/types'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface RecentTransactionsProps {
  transactions: TransactionWithTruck[]
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  if (transactions.length === 0) {
    return (
      <Card className="rounded-xl border-0 shadow-[0_1px_3px_0_rgb(0_0_0/0.1)]">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Transacciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base text-muted-foreground">
            No hay transacciones registradas este mes.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border-0 shadow-[0_1px_3px_0_rgb(0_0_0/0.1)]">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Transacciones Recientes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Table header - hidden on mobile */}
          <div className="hidden gap-4 border-b border-border px-4 pb-3 text-sm font-medium text-muted-foreground md:grid md:grid-cols-12">
            <span className="col-span-4">Descripción</span>
            <span className="col-span-2">Camión</span>
            <span className="col-span-2">Fecha</span>
            <span className="col-span-2 text-center">Tipo</span>
            <span className="col-span-2 text-right">Monto</span>
          </div>

          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex flex-col gap-2 rounded-lg px-4 py-3 transition-colors hover:bg-muted/50 md:grid md:grid-cols-12 md:items-center md:gap-4 md:py-3"
            >
              <div className="col-span-4">
                <p className="text-base font-medium">{tx.description}</p>
              </div>
              <div className="col-span-2">
                <span className="text-sm text-muted-foreground">{tx.truck.plate}</span>
              </div>
              <div className="col-span-2">
                <span className="text-sm text-muted-foreground">
                  {new Date(tx.date).toLocaleDateString('es-AR')}
                </span>
              </div>
              <div className="col-span-2 flex items-center justify-start md:justify-center">
                <Badge
                  variant={tx.type === 'INCOME' ? 'default' : 'destructive'}
                  className={cn(
                    'flex items-center gap-1 text-sm',
                    tx.type === 'INCOME'
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : '',
                  )}
                >
                  {tx.type === 'INCOME' ? (
                    <ArrowUpRight className="size-3" />
                  ) : (
                    <ArrowDownRight className="size-3" />
                  )}
                  {tx.type === 'INCOME' ? 'Ingreso' : 'Gasto'}
                </Badge>
              </div>
              <div className="col-span-2 text-right">
                <span
                  className={cn(
                    'text-lg font-semibold',
                    tx.type === 'INCOME'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {tx.type === 'INCOME' ? '+' : '-'}${tx.amount.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
