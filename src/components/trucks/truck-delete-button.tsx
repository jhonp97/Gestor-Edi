'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface TruckDeleteButtonProps {
  truckId: string
  truckName: string
}

export function TruckDeleteButton({ truckId, truckName }: TruckDeleteButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`¿Eliminar el camión "${truckName}"? Se eliminarán sus transacciones, kilometrajes e historial operativo. Se conservarán las nóminas, los días de pago de los empleados y los datos de otros camiones. Esta acción no se puede deshacer.`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/trucks/${truckId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmHistoryDeletion: true }),
      })
      if (res.ok) {
        router.push('/trucks')
        router.refresh()
      } else {
        let message = 'Error al eliminar camión'
        try {
          const data: unknown = await res.json()
          if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
            message = data.error
          }
        } catch {
          // A non-JSON server failure is not a network failure.
        }
        alert(message)
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="destructive" onClick={handleDelete} disabled={loading}>
      <Trash2 className="mr-2 size-4" />
      {loading ? 'Eliminando...' : 'Eliminar'}
    </Button>
  )
}