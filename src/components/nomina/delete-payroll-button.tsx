'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DeletePayrollButtonProps {
  payrollId: string
  workerName: string
  periodLabel: string
  compact?: boolean
}

export function DeletePayrollButton({ payrollId, workerName, periodLabel, compact = false }: DeletePayrollButtonProps) {
  const router = useRouter()
  const busy = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    if (busy.current) return
    if (!window.confirm(`¿Eliminar la nómina pendiente de ${workerName} (${periodLabel})? Esta acción no se puede deshacer.`)) return
    busy.current = true
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('auth-token')
      const response = await fetch(`/api/payroll/${payrollId}`, {
        method: 'DELETE',
        headers: token ? { 'x-auth-token': token } : {},
      })
      if (!response.ok) {
        const data = await response.json()
        setError(typeof data.error === 'string' ? data.error : 'Error al eliminar la nómina')
        return
      }
      router.refresh()
    } catch {
      setError('Error de conexión al eliminar la nómina')
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="destructive"
        size={compact ? 'icon' : 'sm'}
        title="Eliminar nómina pendiente"
        aria-label={`Eliminar nómina pendiente de ${workerName}`}
        disabled={loading}
        onClick={handleDelete}
      >
        <Trash2 className="size-4" />
        {!compact && (loading ? 'Eliminando...' : 'Eliminar')}
      </Button>
      {error && <p role="alert" className="mt-1 max-w-64 text-xs text-destructive">{error}</p>}
    </div>
  )
}
