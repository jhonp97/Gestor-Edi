'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi } from '@/hooks/use-api'
import type { ProfileData } from './profile-tabs'

export function OrganizationTab({ profile }: { profile: ProfileData }) {
  const [orgName, setOrgName] = useState(profile.organization.name)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const { post } = useApi()
  const canEdit = profile.role === 'ORG_ADMIN' || profile.role === 'PLATFORM_ADMIN'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setMessage('')
    try {
      await post('/api/organization', { name: orgName }, { method: 'PATCH' })
      setMessage('Organización actualizada')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organización</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="orgName">Nombre de la organización</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={!canEdit}
              className={!canEdit ? 'bg-muted' : ''}
            />
            {!canEdit && (
              <p className="mt-1 text-xs text-muted-foreground">Solo los administradores pueden editar.</p>
            )}
          </div>
          {canEdit && (
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
          {message && (
            <p className={`text-sm ${message.includes('Error') ? 'text-destructive' : 'text-green-600'}`}>{message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
