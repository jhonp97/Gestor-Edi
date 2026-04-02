import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Worker } from '@/types'

const statusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ON_LEAVE: 'Licencia',
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  ON_LEAVE: 'secondary',
  INACTIVE: 'destructive',
}

interface WorkerCardProps {
  worker: Worker
}

export function WorkerCard({ worker }: WorkerCardProps) {
  return (
    <Link href={`/workers/${worker.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{worker.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-muted-foreground">
              {worker.dni}
            </span>
            <Badge variant={statusVariant[worker.status] ?? 'secondary'}>
              {statusLabels[worker.status] ?? worker.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {worker.position}
          </p>
          <p className="text-sm text-muted-foreground">
            Salario base: ${worker.baseSalary.toLocaleString('es-AR')}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
