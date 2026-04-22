'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordInput } from '@/components/ui/password-input'
import { useApi } from '@/hooks/use-api'

export function SecurityTab() {
  const { post } = useApi()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Las contraseñas no coinciden')
      return
    }
    setPasswordLoading(true)
    setPasswordMessage('')
    try {
      await post('/api/profile/password', { currentPassword, newPassword, confirmPassword })
      setPasswordMessage('Contraseña actualizada')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? (JSON.parse(err.message).error as string) : 'Error'
      setPasswordMessage(msg)
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <PasswordInput id="currentPassword" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <PasswordInput id="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
              <PasswordInput id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.includes('Error') || passwordMessage.includes('coinciden') ? 'text-destructive' : 'text-green-600'}`}>
                {passwordMessage}
              </p>
            )}
            <Button type="submit" disabled={passwordLoading} className="bg-primary text-primary-foreground">
              {passwordLoading ? 'Guardando...' : 'Cambiar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 2FA SMS - Deshabilitado temporalmente (Twilio es de pago) */}
      {/* TODO: Habilitar cuando se configuren variables TWILIO_* */}
    </div>
  )
}
