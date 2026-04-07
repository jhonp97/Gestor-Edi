'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check auth on mount and navigation
    const checkAuth = () => {
      const token = localStorage.getItem('auth-token')
      
      // If no token and trying to access protected route, redirect to login
      const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/offline']
      const isPublicRoute = publicRoutes.includes(pathname)
      
      if (!token && !isPublicRoute) {
        router.push('/login')
        return false
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

      return true
    }

    checkAuth()
    setIsLoading(false)
  }, [pathname, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]"></div>
      </div>
    )
  }

  return <>{children}</>
}
