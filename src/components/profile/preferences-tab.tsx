'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProfileData } from './profile-tabs'

export function PreferencesTab({
  profile,
  onUpdate,
}: {
  profile: ProfileData
  onUpdate: (data: Partial<ProfileData>) => Promise<ProfileData>
}) {
  const [language, setLanguage] = useState(profile.language)
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile.notificationsEnabled)
  const [emailNotifications, setEmailNotifications] = useState(profile.emailNotifications)
  const [smsNotifications, setSmsNotifications] = useState(profile.smsNotifications)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await onUpdate({ language, notificationsEnabled, emailNotifications, smsNotifications })
      setMessage('Preferencias guardadas')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="language">Idioma</Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="notificationsEnabled"
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary"
            />
            <Label htmlFor="notificationsEnabled" className="mb-0">Habilitar notificaciones</Label>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="emailNotifications"
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary"
            />
            <Label htmlFor="emailNotifications" className="mb-0">Notificaciones por email</Label>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="smsNotifications"
              type="checkbox"
              checked={smsNotifications}
              onChange={(e) => setSmsNotifications(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary"
            />
            <Label htmlFor="smsNotifications" className="mb-0">Notificaciones por SMS</Label>
          </div>

          {message && (
            <p className={`text-sm ${message.includes('Error') ? 'text-destructive' : 'text-green-600'}`}>{message}</p>
          )}
          <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? 'Guardando...' : 'Guardar preferencias'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
