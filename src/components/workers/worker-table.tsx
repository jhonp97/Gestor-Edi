'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Trash2, Edit } from 'lucide-react'
import Link from 'next/link'
import type { Worker, Truck } from '@/types'

interface WorkerTableProps {
  workers: Worker[]
  trucks: Truck[]
}

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

export function WorkerTable({ workers, trucks }: WorkerTableProps) {
  const [search, setSearch] = useState('')
  const truckMap = new Map(trucks.map((t) => [t.id, t]))

  const filteredWorkers = workers.filter((w) => {
    if (!search) return true
    const q = search.toLowerCase()
    return w.name.toLowerCase().includes(q) || w.dni.toLowerCase().includes(q)
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Trabajadores</CardTitle>
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o DNI..."
            className="max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Nombre</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">DNI</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Puesto</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Salario Base</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Estado</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Camión</th>
                <th className="pb-3 font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((worker) => (
                <tr
                  key={worker.id}
                  className="border-b last:border-b-0"
                >
                  <td className="py-3 pr-4 font-medium">{worker.name}</td>
                  <td className="py-3 pr-4 font-mono text-sm">{worker.dni}</td>
                  <td className="py-3 pr-4">{worker.position}</td>
                  <td className="py-3 pr-4">${worker.baseSalary.toLocaleString('es-AR')}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={statusVariant[worker.status] ?? 'secondary'}>
                      {statusLabels[worker.status] ?? worker.status}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">
                    {worker.truckId
                      ? truckMap.get(worker.truckId)?.plate ?? '—'
                      : '—'}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <Link href={`/workers/${worker.id}`}>
                        <Button variant="ghost" size="icon">
                          <Edit className="size-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (confirm(`¿Eliminar a ${worker.name}?`)) {
                            await fetch(`/api/workers/${worker.id}`, { method: 'DELETE' })
                            window.location.reload()
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
