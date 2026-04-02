'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import type { Truck } from '@/types'

interface WorkerFormProps {
  trucks: Truck[]
}

export function WorkerForm({ trucks }: WorkerFormProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [dni, setDni] = useState('')
  const [position, setPosition] = useState('')
  const [baseSalary, setBaseSalary] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState('ACTIVE')
  const [truckId, setTruckId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Basic validation
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
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dni: dni.toUpperCase(),
          position,
          baseSalary: Number(baseSalary),
          startDate: new Date(startDate).toISOString(),
          status,
          truckId: truckId || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al crear trabajador')
        return
      }

      router.push('/workers')
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} size="lg">
        <Plus className="mr-2 size-5" aria-hidden="true" />
        Nuevo Trabajador
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="name" className="text-base">
          Nombre
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Juan Pérez"
          className="text-lg"
          required
        />
      </div>
      <div>
        <Label htmlFor="dni" className="text-base">
          DNI
        </Label>
        <Input
          id="dni"
          value={dni}
          onChange={(e) => setDni(e.target.value.toUpperCase())}
          placeholder="12345678A"
          className="text-lg"
          required
        />
      </div>
      <div>
        <Label htmlFor="position" className="text-base">
          Puesto
        </Label>
        <Input
          id="position"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Conductor"
          className="text-lg"
          required
        />
      </div>
      <div>
        <Label htmlFor="baseSalary" className="text-base">
          Salario Base
        </Label>
        <Input
          id="baseSalary"
          type="number"
          value={baseSalary}
          onChange={(e) => setBaseSalary(e.target.value)}
          placeholder="2500"
          className="w-32 text-lg"
          min="0"
          step="0.01"
          required
        />
      </div>
      <div>
        <Label htmlFor="startDate" className="text-base">
          Fecha Inicio
        </Label>
        <Input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="text-lg"
          required
        />
      </div>
      <div>
        <Label htmlFor="status" className="text-base">
          Estado
        </Label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="ACTIVE">Activo</option>
          <option value="INACTIVE">Inactivo</option>
          <option value="ON_LEAVE">Licencia</option>
        </select>
      </div>
      <div>
        <Label htmlFor="truckId" className="text-base">
          Camión (opcional)
        </Label>
        <select
          id="truckId"
          value={truckId}
          onChange={(e) => setTruckId(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Sin asignar</option>
          {trucks.map((truck) => (
            <option key={truck.id} value={truck.id}>
              {truck.brand} {truck.model} ({truck.plate})
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setIsOpen(false)}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
      {error && (
        <p className="w-full text-sm text-destructive">{error}</p>
      )}
    </form>
  )
}
