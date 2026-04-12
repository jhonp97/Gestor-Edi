'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Wifi, WifiOff, LogOut } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'

function subscribeToOnlineState(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

const pageLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/trucks': 'Camiones',
  '/transactions': 'Transacciones',
  '/workers': 'Trabajadores',
  '/nomina': 'Nómina',
  '/admin/users': 'Usuarios',
}

interface SessionUser {
  id: string
  name: string
  email: string
  role: string
}

export function Header() {
  const isOnline = useSyncExternalStore(subscribeToOnlineState, getOnlineSnapshot, () => true)
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const { get } = useApi()

  const currentPage = pageLabels[pathname] || pageLabels[pathname.split('/').slice(0, 2).join('/')] || 'Página'

  useEffect(() => {
    get<{ user: SessionUser }>('/api/auth/session')
      .then((data) => {
        if (data?.user) setUser(data.user)
      })
      .catch(() => {})
  }, [get])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await get<{ success?: boolean }>('/api/auth/logout', { method: 'POST' })
      // Full page reload to clear both auth systems (custom JWT + NextAuth)
      window.location.href = '/login'
    } catch {
      setLoggingOut(false)
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Inicio</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-base font-semibold text-foreground">{currentPage}</span>
      </div>

      {/* Right side: indicators */}
      <div className="flex items-center gap-4">
        {/* Offline indicator */}
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            isOnline
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}
          role="status"
          aria-live="polite"
        >
          {isOnline ? (
            <Wifi className="size-4" aria-hidden="true" />
          ) : (
            <WifiOff className="size-4" aria-hidden="true" />
          )}
          {isOnline ? 'En línea' : 'Sin conexión'}
        </div>

        {/* User greeting */}
        {user && (
          <span className="hidden text-sm font-medium text-foreground sm:block">
            Hola {user.name.split(' ')[0]}
          </span>
        )}

        {/* User avatar */}
        <div className="hidden size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary sm:flex">
          {user ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>

        {/* Logout button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Cerrar sesión"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}
