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

interface TransactionFormProps {
  trucks: Truck[]
}

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function TransactionForm({ trucks }: TransactionFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [truckId, setTruckId] = useState('')
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16))
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function resetForm() {
    setTruckId('')
    setType('EXPENSE')
    setAmount('')
    setDescription('')
    setDate(new Date().toISOString().slice(0, 16))
    setCategory('')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckId,
          type,
          amount: parseFloat(amount),
          description,
          date: new Date(date).toISOString(),
          category: category || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al crear transacción')
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
          Agregar Transacción
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva Transacción</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="tx-truck">Camión</Label>
            <select
              id="tx-truck"
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
              className={selectClass}
              required
            >
              <option value="">Seleccionar...</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plate} — {t.brand} {t.model}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="tx-type">Tipo</Label>
              <select
                id="tx-type"
                value={type}
                onChange={(e) => setType(e.target.value as 'INCOME' | 'EXPENSE')}
                className={selectClass}
              >
                <option value="INCOME">Ingreso</option>
                <option value="EXPENSE">Gasto</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tx-amount">Monto (€)</Label>
              <Input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="tx-desc">Descripción</Label>
            <Input
              id="tx-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Concepto..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="tx-date">Fecha</Label>
              <Input
                id="tx-date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tx-cat">Categoría</Label>
              <Input
                id="tx-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Opcional"
              />
            </div>
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
              {loading ? 'Guardando...' : 'Guardar Transacción'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
