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
    if (!confirm(`¿Eliminar el camión "${truckName}"? Se eliminarán también todas sus transacciones. Esta acción no se puede deshacer.`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/trucks/${truckId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/trucks')
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Error al eliminar camión')
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