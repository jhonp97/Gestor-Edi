'use client'

import { Button } from '@/components/ui/button'

interface DeleteWorkerButtonProps {
  workerId: string
  workerName: string
}

export function DeleteWorkerButton({ workerId, workerName }: DeleteWorkerButtonProps) {
  const handleDelete = async () => {
    if (!confirm(`¿Eliminar a ${workerName}? Esta acción no se puede deshacer.`)) {
      return
    }

    const token = localStorage.getItem('auth-token')
    const res = await fetch(`/api/workers/${workerId}`, {
      method: 'DELETE',
      headers: token ? { 'x-auth-token': token } : {},
    })

    if (res.ok) {
      window.location.href = '/workers'
    } else {
      alert('Error al eliminar trabajador')
    }
  }

  return (
    <Button variant="destructive" onClick={handleDelete}>
      Eliminar
    </Button>
  )
}