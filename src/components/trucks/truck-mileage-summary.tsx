import { Card, CardContent } from '@/components/ui/card'
import { Gauge, CalendarDays, Calendar } from 'lucide-react'
import type { MileageSummaryProps } from '@/types'

export function TruckMileageSummary({ totalKm, monthlyKm, yearlyKm }: MileageSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Gauge className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Total Kilómetros</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {totalKm.toLocaleString('es-ES')} km
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Km este mes</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {monthlyKm.toLocaleString('es-ES')} km
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Km este año</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {yearlyKm.toLocaleString('es-ES')} km
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
