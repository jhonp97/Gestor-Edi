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
import { Gauge } from 'lucide-react'

export function TruckMileageModal({ truckId }: { truckId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [km, setKm] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const kmValue = parseFloat(km)
    if (isNaN(kmValue) || kmValue <= 0) {
      setError('Los kilómetros deben ser un número positivo')
      return
    }
    if (kmValue > 5000) {
      setError('Máximo 5000 km por día')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`/api/trucks/${truckId}/mileage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          km: kmValue,
          notes: notes || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al registrar kilometraje')
        return
      }

      setOpen(false)
      setKm('')
      setNotes('')
      setDate(new Date().toISOString().split('T')[0])
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button type="button">
          <Gauge className="mr-2 size-4" />
          Registrar Kilometraje
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Kilometraje</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="mileage-date">Fecha</Label>
            <Input
              id="mileage-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="mileage-km">Kilómetros</Label>
            <Input
              id="mileage-km"
              type="number"
              step="0.1"
              min="0.1"
              max="5000"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="Ej: 150"
              required
            />
            <p className="text-xs text-muted-foreground">
              Máximo 5.000 km por día
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="mileage-notes">Notas (opcional)</Label>
            <textarea
              id="mileage-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Viaje a Barcelona"
              maxLength={255}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
