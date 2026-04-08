'use client'

import { useState, useEffect, useCallback } from 'react'
import { getOfflineToken } from '@/lib/offline'

const DB_NAME = 'flota-auth-db'
const STORE_NAME = 'auth'
const TOKEN_KEY = 'jwt-token'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

export async function getStoredToken(): Promise<string | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(TOKEN_KEY)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

export async function saveTokenForOffline(token: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(token, TOKEN_KEY)
  } catch (error) {
    console.error('Failed to save token for offline:', error)
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(TOKEN_KEY)
  } catch (error) {
    console.error('Failed to clear token:', error)
  }
}

// Hook para estado de red
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
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
  const offlineToken = await getStoredToken()

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