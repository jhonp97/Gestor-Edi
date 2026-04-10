'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import type { Truck } from '@/types'

interface WorkerFormProps {
  trucks: Truck[]
}

type DocType = 'DNI' | 'NIE' | 'PASAPORTE' | 'OTRO'

const DOC_PATTERNS: Record<DocType, { regex: RegExp | null; placeholder: string; hint: string }> = {
  DNI: { regex: /^\d{8}[A-Z]$/, placeholder: '12345678A', hint: '8 números + 1 letra' },
  NIE: { regex: /^[XYZ]\d{7}[A-Z]$/, placeholder: 'X1234567A', hint: 'X/Y/Z + 7 números + 1 letra' },
  PASAPORTE: { regex: /^[A-Z0-9]{6,9}$/, placeholder: 'ABC123456', hint: '6-9 caracteres alfanuméricos' },
  OTRO: { regex: null, placeholder: 'Documento', hint: 'Cualquier formato' },
}

function validateDoc(type: DocType, value: string): boolean {
  const pattern = DOC_PATTERNS[type].regex
  if (!pattern) return value.trim().length > 0
  return pattern.test(value.toUpperCase())
}

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function WorkerForm({ trucks }: WorkerFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [docType, setDocType] = useState<DocType>('DNI')
  const [dni, setDni] = useState('')
  const [position, setPosition] = useState('')
  const [baseSalary, setBaseSalary] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState('ACTIVE')
  const [truckId, setTruckId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function resetForm() {
    setName('')
    setDocType('DNI')
    setDni('')
    setPosition('')
    setBaseSalary('')
    setStartDate(new Date().toISOString().split('T')[0])
    setStatus('ACTIVE')
    setTruckId('')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateDoc(docType, dni)) {
      setError(`${docType} inválido. ${DOC_PATTERNS[docType].hint}`)
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
          dni: docType === 'OTRO' ? dni.trim() : dni.toUpperCase(),
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

      setOpen(false)
      resetForm()
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      
      <DialogTrigger>
        <Button size="lg" type="button">
          <Plus className="mr-2 size-5" aria-hidden="true" />
          Nuevo Trabajador
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Trabajador</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="name">Nombre completo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Pérez"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="docType">Tipo Documento</Label>
              <select
                id="docType"
                value={docType}
                onChange={(e) => { setDocType(e.target.value as DocType); setDni('') }}
                className={selectClass}
              >
                <option value="DNI">DNI</option>
                <option value="NIE">NIE</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dni">
                {docType === 'OTRO' ? 'Nº Documento' : docType}
              </Label>
              <Input
                id="dni"
                value={dni}
                onChange={(e) => setDni(docType === 'OTRO' ? e.target.value : e.target.value.toUpperCase())}
                placeholder={DOC_PATTERNS[docType].placeholder}
                required
              />
              <p className="text-xs text-muted-foreground">{DOC_PATTERNS[docType].hint}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="position">Puesto</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Conductor"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="baseSalary">Salario Base (€)</Label>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startDate">Fecha Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectClass}
              >
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="ON_LEAVE">Licencia</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="truckId">Camión asignado (opcional)</Label>
            <select
              id="truckId"
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
              className={selectClass}
            >
              <option value="">Sin asignar</option>
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.brand} {truck.model} ({truck.plate})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); resetForm() }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Trabajador'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}