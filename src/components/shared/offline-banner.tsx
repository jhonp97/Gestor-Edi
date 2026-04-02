'use client'

import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

function subscribeToOnlineState(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOfflineSnapshot() {
  return typeof navigator !== 'undefined' ? !navigator.onLine : false
}

export function OfflineBanner() {
  const isOffline = useSyncExternalStore(subscribeToOnlineState, getOfflineSnapshot, () => false)

  if (!isOffline) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-3 text-white"
      role="alert"
      aria-live="assertive"
    >
      <WifiOff className="size-5" aria-hidden="true" />
      <span className="text-lg font-medium">
        No hay conexión a internet. Algunas funciones pueden no estar disponibles.
      </span>
    </div>
  )
}
