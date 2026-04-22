'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordInput } from '@/components/ui/password-input'
import { useApi } from '@/hooks/use-api'
import type { ProfileData } from './profile-tabs'

export function SecurityTab({ profile }: { profile: ProfileData }) {
  const { post } = useApi()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [code, setCode] = useState('')
  const [twoFAMessage, setTwoFAMessage] = useState('')
  const [twoFALoading, setTwoFALoading] = useState(false)
  const [twoFAStep, setTwoFAStep] = useState<'idle' | 'sent'>(profile.twoFactorEnabled ? 'idle' : 'idle')

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

  async function handleSendCode() {
    setTwoFALoading(true)
    setTwoFAMessage('')
    try {
      await post('/api/2fa/send-code', {})
      setTwoFAStep('sent')
      setTwoFAMessage('Código enviado')
    } catch (err: unknown) {
      const msg = err instanceof Error ? (JSON.parse(err.message).error as string) : 'Error'
      setTwoFAMessage(msg)
    } finally {
      setTwoFALoading(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setTwoFALoading(true)
    setTwoFAMessage('')
    try {
      await post('/api/2fa/verify', { code })
      setTwoFAMessage('2FA habilitado')
      setTwoFAStep('idle')
      setCode('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? (JSON.parse(err.message).error as string) : 'Error'
      setTwoFAMessage(msg)
    } finally {
      setTwoFALoading(false)
    }
  }

  async function handleDisable2FA(e: React.FormEvent) {
    e.preventDefault()
    setTwoFALoading(true)
    setTwoFAMessage('')
    try {
      await post('/api/2fa/disable', { password: currentPassword })
      setTwoFAMessage('2FA deshabilitado')
      setCurrentPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? (JSON.parse(err.message).error as string) : 'Error'
      setTwoFAMessage(msg)
    } finally {
      setTwoFALoading(false)
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

      <Card>
        <CardHeader>
          <CardTitle>Autenticación de dos factores (SMS)</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.twoFactorEnabled ? (
            <form onSubmit={handleDisable2FA} className="space-y-4">
              <p className="text-sm text-muted-foreground">2FA está habilitado.</p>
              <div>
                <Label htmlFor="disablePassword">Contraseña actual para deshabilitar</Label>
                <PasswordInput id="disablePassword" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
              {twoFAMessage && (
                <p className={`text-sm ${twoFAMessage.includes('Error') || twoFAMessage.includes('incorrecta') ? 'text-destructive' : 'text-green-600'}`}>
                  {twoFAMessage}
                </p>
              )}
              <Button type="submit" disabled={twoFALoading} variant="destructive">
                {twoFALoading ? 'Procesando...' : 'Deshabilitar 2FA'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Habilitá 2FA para agregar una capa extra de seguridad. Se enviará un código SMS a tu teléfono.
              </p>
              {twoFAStep === 'idle' && (
                <Button onClick={handleSendCode} disabled={twoFALoading} className="bg-primary text-primary-foreground">
                  {twoFALoading ? 'Enviando...' : 'Enviar código'}
                </Button>
              )}
              {twoFAStep === 'sent' && (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <Label htmlFor="code">Código de 6 dígitos</Label>
                    <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={6} pattern="\\d{6}" />
                  </div>
                  <Button type="submit" disabled={twoFALoading} className="bg-primary text-primary-foreground">
                    {twoFALoading ? 'Verificando...' : 'Verificar y habilitar'}
                  </Button>
                </form>
              )}
              {twoFAMessage && (
                <p className={`text-sm ${twoFAMessage.includes('Error') || twoFAMessage.includes('inválido') ? 'text-destructive' : 'text-green-600'}`}>
                  {twoFAMessage}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
