'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { saveTokenForOffline, getOfflineToken } from '@/lib/offline'

// Hook para estado de red usando useSyncExternalStore
function subscribeToOnline(callback: () => void) {
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

export function useNetworkStatus() {
  return useSyncExternalStore(subscribeToOnline, getOnlineSnapshot, () => true)
}

// Fetch wrapper con soporte offline
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('credentials', 'include')

  // Si está online, intentar normalmente
  if (navigator.onLine) {
    try {
      const response = await fetch(url, { ...options, headers })

      // Después de login exitoso, guardar token para offline
      if (response.ok && url.includes('/api/auth/login')) {
        const data = await response.clone().json().catch(() => ({}))
        if (data?.token) {
          await saveTokenForOffline(data.token)
        }
      }

      return response
    } catch (error) {
      console.warn('Online fetch failed, trying offline:', error)
    }
  }

  // Offline: usar token de IndexedDB
  const offlineToken = await getOfflineToken()

  if (offlineToken) {
    headers.set('x-auth-token', offlineToken)

    try {
      const response = await fetch(url, { ...options, headers })
      if (response.ok) {
        return response
      }
    } catch {
      // Offline request failed
    }
  }

  throw new Error(
    navigator.onLine
      ? 'Error de conexión'
      : 'Sin conexión a internet. Conectate para continuar.'
  )
}

// Hook para hacer requests con soporte offline
export function useApi() {
  const isOnline = useNetworkStatus()

  const get = useCallback(async <T>(url: string, options?: RequestInit): Promise<T> => {
    const res = await apiFetch(url, { method: 'GET', ...options })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }, [])

  const post = useCallback(async <T>(url: string, body: unknown, options?: RequestInit): Promise<T> => {
    const res = await apiFetch(url, {
      method: options?.method || 'POST',
      body: JSON.stringify(body),
      ...options,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }, [])

  const put = useCallback(async <T>(url: string, body: unknown): Promise<T> => {
    const res = await apiFetch(url, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }, [])

  const del = useCallback(async <T>(url: string): Promise<T> => {
    const res = await apiFetch(url, { method: 'DELETE' })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }, [])

  return { get, post, put, del, isOnline }
}