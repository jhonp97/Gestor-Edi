'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

interface MarkAsPaidButtonProps {
  payrollId: string
  workerName: string
}

export function MarkAsPaidButton({ payrollId, workerName }: MarkAsPaidButtonProps) {
  const router = useRouter()

  const handleMarkAsPaid = async () => {
    if (!confirm(`¿Marcar la nómina de ${workerName} como pagada?`)) {
      return
    }

    const token = localStorage.getItem('auth-token')
    const res = await fetch(`/api/payroll/${payrollId}/mark-paid`, {
      method: 'POST',
      headers: token ? { 'x-auth-token': token } : {},
    })

    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json()
      alert(data.error || 'Error al marcar como pagado')
    }
  }

  return (
    <Button onClick={handleMarkAsPaid}>
      <CheckCircle className="mr-2 size-4" />
      Marcar como Pagado
    </Button>
  )
}