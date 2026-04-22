'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AvatarUpload } from './avatar-upload'
import type { ProfileData } from './profile-tabs'

export function PersonalInfoTab({
  profile,
  onUpdate,
}: {
  profile: ProfileData
  onUpdate: (data: Partial<ProfileData>) => Promise<ProfileData>
}) {
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await onUpdate({ name, phone: phone || undefined })
      setMessage('Cambios guardados')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos personales</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <AvatarUpload currentImage={profile.image} onUploaded={(url) => onUpdate({ image: url })} />
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile.email} disabled className="bg-muted" />
            <p className="mt-1 text-xs text-muted-foreground">El email no se puede editar.</p>
          </div>
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 612 345 678"
              title="Formato internacional: +34 612 345 678"
            />
            <p className="mt-1 text-xs text-muted-foreground">Formato internacional con prefijo de país. Ej: +34 612 345 678</p>
          </div>
          {message && (
            <p className={`text-sm ${message.includes('Error') ? 'text-destructive' : 'text-green-600'}`}>{message}</p>
          )}
          <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
