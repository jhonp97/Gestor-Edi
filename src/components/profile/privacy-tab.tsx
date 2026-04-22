'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi } from '@/hooks/use-api'
import type { ProfileData } from './profile-tabs'

export function PrivacyTab({ profile }: { profile: ProfileData }) {
  const { post } = useApi()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/data/export', { method: 'POST', credentials: 'include' })
      if (!response.ok) throw new Error('Error al exportar')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mis-datos-${profile.id}.json`
      a.click()
      window.URL.revokeObjectURL(url)
      setMessage('Descarga iniciada')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error al exportar')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteRequest() {
    if (!confirm('¿Estás seguro? Tu cuenta será eliminada en 30 días.')) return
    setLoading(true)
    setMessage('')
    try {
      await post('/api/data/delete-request', {})
      setMessage('Solicitud enviada. Tu cuenta será eliminada en 30 días.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? (JSON.parse(err.message).error as string) : 'Error'
      setMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Consentimiento GDPR</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {profile.gdprConsentGiven
              ? 'Ya diste tu consentimiento para el procesamiento de datos.'
              : 'No has dado tu consentimiento aún.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exportar mis datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Descargá una copia de tus datos personales en formato JSON.
          </p>
          <Button onClick={handleExport} disabled={loading} className="bg-primary text-primary-foreground">
            {loading ? 'Procesando...' : 'Exportar datos'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Eliminar mi cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Solicitá la eliminación de tu cuenta. Tenés un período de gracia de 30 días para cancelar la solicitud.
          </p>
          <Button onClick={handleDeleteRequest} disabled={loading} variant="destructive">
            {loading ? 'Procesando...' : 'Solicitar eliminación'}
          </Button>
          {message && (
            <p className={`text-sm ${message.includes('Error') || message.includes('último administrador') ? 'text-destructive' : 'text-green-600'}`}>
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
