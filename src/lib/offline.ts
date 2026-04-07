/**
 * Offline Authentication System
 * 
 * Uses IndexedDB to store the JWT token for offline access.
 * The token is sent via x-auth-token header when offline.
 * Cookies are still used for HTTP-only secure sessions when online.
 */

import { useState, useEffect } from 'react'

const DB_NAME = 'flota-auth-db'
const STORE_NAME = 'auth'
const TOKEN_KEY = 'jwt-token'

// Open IndexedDB
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

// Save token to IndexedDB for offline access
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

// Get token from IndexedDB for offline access
export async function getOfflineToken(): Promise<string | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(TOKEN_KEY)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Failed to get offline token:', error)
    return null
  }
}

// Remove token from IndexedDB (logout)
export async function clearOfflineToken(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(TOKEN_KEY)
  } catch (error) {
    console.error('Failed to clear offline token:', error)
  }
}

// Enhanced fetch that works offline
export async function authFetchWithOffline(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers)
  headers.set('credentials', 'include')

  // Check if online
  if (navigator.onLine) {
    try {
      const response = await fetch(url, { ...options, headers })
      
      // After successful login, save token for offline
      if (response.ok && url.includes('/api/auth/login')) {
        const data = await response.clone().json().catch(() => ({}))
        if (data?.token) {
          await saveTokenForOffline(data.token)
        }
      }
      
      return response
    } catch (error) {
      console.error('Online fetch failed, trying offline:', error)
    }
  }

  // Offline mode - use token from IndexedDB
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
      ? 'Error de conexion' 
      : 'Sin conexion a internet. Conectate para continuar.'
  )
}

// Hook to check online/offline status
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