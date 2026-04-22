/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LayoutDashboard, Truck, Receipt, Users, Banknote, Menu, X, Shield, LogOut, BarChart3, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useApi } from '@/hooks/use-api'
import { clearOfflineToken } from '@/lib/offline'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trucks', label: 'Camiones', icon: Truck },
  { href: '/transactions', label: 'Transacciones', icon: Receipt },
  { href: '/workers', label: 'Trabajadores', icon: Users },
  { href: '/nomina', label: 'Nómina', icon: Banknote },
]

interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  image?: string | null
}

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const { get } = useApi()

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
    } catch {
      // Continue cleanup even if API call fails
    }

    // Clear NextAuth session (Google OAuth)
    await signOut({ redirect: false })

    // Clear all client-side storage to prevent session leakage
    localStorage.removeItem('auth-token')
    await clearOfflineToken()

    // Full page reload to clear both auth systems (custom JWT + NextAuth)
    window.location.href = '/login'
  }

  return (
    <>
      {/* Mobile hamburger - only visible when sidebar is closed */}
      {!mobileOpen && (
        <button
          className="fixed left-4 top-4 z-50 rounded-lg bg-primary p-2 text-primary-foreground shadow-md transition-all hover:bg-primary/90 md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="size-6" />
        </button>
      )}

      <aside
        className={cn(
          'flex flex-col border-r border-white/10 bg-primary text-primary-foreground transition-transform duration-300',
          'fixed inset-y-0 left-0 z-40 w-56 md:relative md:z-auto md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        role="navigation"
        aria-label="Navegación principal"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white/10">
            <Truck className="size-6" aria-hidden="true" />
          </div>
          <div className="flex flex-1 items-center justify-between overflow-hidden">
            <div>
              <h1 className="text-lg font-bold leading-tight">Flota Camiones</h1>
              <p className="text-xs text-white/60">Gestión de flota</p>
            </div>
            {/* Close button on mobile */}
            <button
              className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-white/80 hover:bg-white/10 hover:text-white',
                )}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className="size-5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {/* Admin links - solo para PLATFORM_ADMIN */}
          {user?.role === 'PLATFORM_ADMIN' && (
            <>
              <Link
                href="/admin"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200',
                  pathname === '/admin'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-white/80 hover:bg-white/10 hover:text-white',
                )}
                onClick={() => setMobileOpen(false)}
              >
                <BarChart3 className="size-5 shrink-0" aria-hidden="true" />
                <span>Panel Admin</span>
              </Link>
              <Link
                href="/admin/orgs"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200',
                  pathname === '/admin/orgs'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-white/80 hover:bg-white/10 hover:text-white',
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Building2 className="size-5 shrink-0" aria-hidden="true" />
                <span>Organizaciones</span>
              </Link>
              <Link
                href="/admin/users"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200',
                  pathname === '/admin/users'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-white/80 hover:bg-white/10 hover:text-white',
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Shield className="size-5 shrink-0" aria-hidden="true" />
                <span>Usuarios</span>
              </Link>
            </>
          )}
        </nav>

        {/* User profile */}
        <div className="border-t border-white/10 px-4 py-4">
          <Link href="/profile" className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-white/10">
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-sm font-semibold">
              {user?.image ? (
                <img src={user.image} alt={user.name} className="size-full object-cover" />
              ) : (
                user ? user.name.charAt(0).toUpperCase() : 'U'
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.name || 'Usuario'}</p>
              <p className="truncate text-xs text-white/60">{user?.email || ''}</p>
            </div>
          </Link>
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Cerrar sesión"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
