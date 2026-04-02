import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
}

export function TruckCard({ truck }: TruckCardProps) {
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
        </CardContent>
      </Card>
    </Link>
  )
}
