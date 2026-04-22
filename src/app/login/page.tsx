'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Truck } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { signOut } from 'next-auth/react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { post } = useApi()

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setEmailError('')
    setPasswordError('')
    setLoading(true)

    try {
      // Clear any existing Google session to prevent session mixing
      await signOut({ redirect: false })

      const data = await post<{ success?: boolean; error?: string; field?: string; token?: string }>('/api/auth/login', { email, password })

      if (data.error) {
        // Set inline errors based on field
        if (data.field === 'email') {
          setEmailError(data.error)
        } else if (data.field === 'password') {
          setPasswordError(data.error)
        } else {
          setError(data.error)
        }
        setLoading(false)
        return
      }

      // Login exitoso - guardar token y redirigir
      if (data.success && data.token) {
        localStorage.setItem('auth-token', data.token)
        window.location.href = '/dashboard'
      }
      return
    } catch (err: unknown) {
      console.error('Login error:', err)
      // Try to parse error response
      if (err instanceof Error && err.message) {
        try {
          const errorData = JSON.parse(err.message)
          if (errorData.error) {
            if (errorData.field === 'email') {
              setEmailError(errorData.error)
            } else if (errorData.field === 'password') {
              setPasswordError(errorData.error)
            } else {
              setError(errorData.error)
            }
            setLoading(false)
            return
          }
        } catch {
          // Not JSON, continue to generic error
        }
      }
      setError('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8e] to-[#1e3a5f] p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <Link href="/">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] shadow-lg">
              <Truck className="size-7 text-white" />
            </div>
          </Link>
          <CardTitle className="text-2xl text-[#1e3a5f]">Iniciar Sesión</CardTitle>
          <CardDescription>
            Ingresá tus datos para acceder a tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full border-2 border-gray-200 hover:bg-gray-50 text-gray-700"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                'Redireccionando...'
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.96 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.96 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continuar con Google
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">o</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-[#1e3a5f]">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                  required
                  autoComplete="email"
                  aria-invalid={emailError ? 'true' : 'false'}
                  aria-describedby={emailError ? 'email-error' : undefined}
                  className={emailError ? 'border-red-500 focus-visible:border-red-500' : ''}
                />
                {emailError && (
                  <p id="email-error" className="text-xs text-red-500 mt-1">{emailError}</p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-[#1e3a5f]">
                  Contraseña
                </label>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError('') }}
                  required
                  autoComplete="current-password"
                  error={passwordError}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white"
                disabled={loading}
              >
                {loading ? 'Ingresando...' : 'Iniciar Sesión'}
              </Button>
            </form>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Link
            href="/forgot-password"
            className="text-sm text-[#4a90d9] hover:text-[#1e3a5f] transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </Link>
          <p className="text-sm text-gray-500">
            ¿No tenés cuenta?{' '}
            <Link href="/register" className="font-medium text-[#1e3a5f] hover:text-[#4a90d9] transition-colors">
              Crear cuenta
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
