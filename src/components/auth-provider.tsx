'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const fetchPatched = useRef(false)

  useEffect(() => {
    // Patch fetch ONCE to inject x-auth-token header for API requests
    if (!fetchPatched.current) {
      fetchPatched.current = true
      const originalFetch = window.fetch
      window.fetch = async function (...args) {
        const [url, options = {}] = args
        const token = localStorage.getItem('auth-token')

        if (token) {
          const newOptions = {
            ...options,
            headers: {
              ...(options.headers || {}),
              'x-auth-token': token,
            },
          }
          return originalFetch(url, newOptions)
        }

        return originalFetch(url, options)
      }
    }
  }, [])

  useEffect(() => {
    // Check auth on mount and navigation via backend session
    const checkAuth = async () => {
      const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/offline']
      const isPublicRoute = publicRoutes.includes(pathname)

      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
        })
        if (!response.ok && !isPublicRoute) {
          router.push('/login')
        }
      } catch {
        if (!isPublicRoute) router.push('/login')
      }
    }

    checkAuth()
  }, [pathname, router])

  return <>{children}</>
}
