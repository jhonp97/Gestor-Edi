'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Worker, Truck, WorkerStatus } from '@/types'

interface WorkerEditFormProps {
  worker: Worker
  trucks: Truck[]
}

export function WorkerEditForm({ worker, trucks }: WorkerEditFormProps) {
  const router = useRouter()
  const [name, setName] = useState(worker.name)
  const [dni, setDni] = useState(worker.dni)
  const [position, setPosition] = useState(worker.position)
  const [baseSalary, setBaseSalary] = useState(worker.baseSalary.toString())
  const [startDate, setStartDate] = useState(
    new Date(worker.startDate).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(
    worker.endDate ? new Date(worker.endDate).toISOString().split('T')[0] : ''
  )
  const [status, setStatus] = useState<WorkerStatus>(worker.status)
  const [truckId, setTruckId] = useState(worker.truckId ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const dniRegex = /^\d{8}[A-Z]$/
    if (!dniRegex.test(dni.toUpperCase())) {
      setError('DNI inválido. Formato: 12345678A')
      return
    }

    if (Number(baseSalary) <= 0) {
      setError('El salario debe ser positivo')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`/api/workers/${worker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dni: dni.toUpperCase(),
          position,
          baseSalary: Number(baseSalary),
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          status,
          truckId: truckId || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al actualizar trabajador')
        return
      }

      router.push(`/workers/${worker.id}`)
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar {worker.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                required
              />
            </div>
            <div>
              <Label htmlFor="dni">DNI</Label>
              <Input
                id="dni"
                value={dni}
                onChange={(e) => setDni(e.target.value.toUpperCase())}
                placeholder="12345678A"
                required
              />
            </div>
            <div>
              <Label htmlFor="position">Puesto</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Conductor"
                required
              />
            </div>
            <div>
              <Label htmlFor="baseSalary">Salario Base</Label>
              <Input
                id="baseSalary"
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                placeholder="2500"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div>
              <Label htmlFor="startDate">Fecha Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="endDate">Fecha Fin (opcional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkerStatus)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="ON_LEAVE">Licencia</option>
              </select>
            </div>
            <div>
              <Label htmlFor="truckId">Camión (opcional)</Label>
              <select
                id="truckId"
                value={truckId}
                onChange={(e) => setTruckId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sin asignar</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.brand} {truck.model} ({truck.plate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/workers/${worker.id}`)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
