import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { Truck } from '@/types'

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

interface TruckCardProps {
  truck: Truck
  stats?: {
    income: number
    expense: number
  }
}

export function TruckCard({ truck, stats }: TruckCardProps) {
  const income = stats?.income ?? 0
  const expense = stats?.expense ?? 0
  const net = income - expense

  return (
    <Link href={`/trucks/${truck.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">
            {truck.brand} {truck.model}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-lg font-mono text-muted-foreground">
              {truck.plate}
            </span>
            <Badge variant={statusVariant[truck.status] ?? 'secondary'}>
              {statusLabels[truck.status] ?? truck.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Año: {truck.year}
          </p>
          
          {/* Stats */}
          <div className="mt-3 pt-3 border-t space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <TrendingUp className="size-3" />
                Ingresos
              </span>
              <span className="font-medium text-green-600">
                ${income.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-red-600">
                <TrendingDown className="size-3" />
                Gastos
              </span>
              <span className="font-medium text-red-600">
                ${expense.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t">
              <span>Balance</span>
              <span className={net >= 0 ? 'text-green-700' : 'text-red-700'}>
                ${net.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
