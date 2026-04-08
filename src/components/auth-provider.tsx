'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check auth on mount and navigation
    const checkAuth = () => {
      const token = localStorage.getItem('auth-token')
      
      // If no token and trying to access protected route, redirect to login
      const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/offline']
      const isPublicRoute = publicRoutes.includes(pathname)
      
      if (!token && !isPublicRoute) {
        router.push('/login')
        return
      }
      
      // Inject token into all fetch requests
      const originalFetch = window.fetch
      window.fetch = async function(...args) {
        const [url, options = {}] = args
        const token = localStorage.getItem('auth-token')
        
        if (token) {
          options.headers = {
            ...options.headers,
            'x-auth-token': token,
          }
        }
        
        return originalFetch(url, options)
      }
    }

    checkAuth()
  }, [pathname, router])

  return <>{children}</>
}
