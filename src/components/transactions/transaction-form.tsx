'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import type { Truck } from '@/types'

interface TransactionFormProps {
  trucks: Truck[]
}

export function TransactionForm({ trucks }: TransactionFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [truckId, setTruckId] = useState('')
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16))
  const [category, setCategory] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      if (res.ok) {
        window.location.reload()
      }
    } catch {
      // Error handling
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} size="lg">
        <Plus className="mr-2 size-5" aria-hidden="true" />
        Agregar Transacción
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="tx-truck" className="text-base">
          Camión
        </Label>
        <select
          id="tx-truck"
          value={truckId}
          onChange={(e) => setTruckId(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-lg"
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
      <div>
        <Label htmlFor="tx-type" className="text-base">
          Tipo
        </Label>
        <select
          id="tx-type"
          value={type}
          onChange={(e) => setType(e.target.value as 'INCOME' | 'EXPENSE')}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-lg"
        >
          <option value="INCOME">Ingreso</option>
          <option value="EXPENSE">Gasto</option>
        </select>
      </div>
      <div>
        <Label htmlFor="tx-amount" className="text-base">
          Monto ($)
        </Label>
        <Input
          id="tx-amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-32 text-lg"
          required
        />
      </div>
      <div>
        <Label htmlFor="tx-desc" className="text-base">
          Descripción
        </Label>
        <Input
          id="tx-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Concepto..."
          className="text-lg"
          required
        />
      </div>
      <div>
        <Label htmlFor="tx-date" className="text-base">
          Fecha
        </Label>
        <Input
          id="tx-date"
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-lg"
          required
        />
      </div>
      <div>
        <Label htmlFor="tx-cat" className="text-base">
          Categoría
        </Label>
        <Input
          id="tx-cat"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Opcional"
          className="text-lg"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg">
          Guardar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setIsOpen(false)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
