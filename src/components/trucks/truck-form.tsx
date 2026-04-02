'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'

export function TruckForm() {
  const [isOpen, setIsOpen] = useState(false)
  const [plate, setPlate] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate, brand, model, year }),
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
        Agregar Camión
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="plate" className="text-base">
          Matrícula
        </Label>
        <Input
          id="plate"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="ABC-123"
          className="text-lg"
          required
        />
      </div>
      <div>
        <Label htmlFor="brand" className="text-base">
          Marca
        </Label>
        <Input
          id="brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Volvo"
          className="text-lg"
          required
        />
      </div>
      <div>
        <Label htmlFor="model" className="text-base">
          Modelo
        </Label>
        <Input
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="FH16"
          className="text-lg"
          required
        />
      </div>
      <div>
        <Label htmlFor="year" className="text-base">
          Año
        </Label>
        <Input
          id="year"
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          min={1990}
          max={new Date().getFullYear() + 1}
          className="w-24 text-lg"
          required
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
