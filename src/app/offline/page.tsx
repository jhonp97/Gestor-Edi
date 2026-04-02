'use client'

import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <WifiOff className="mb-4 size-16 text-muted-foreground" aria-hidden="true" />
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        Sin Conexión
      </h1>
      <p className="mb-6 text-center text-lg text-muted-foreground">
        No estás conectado a internet. Verificá tu conexión e intentá de nuevo.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-primary px-6 py-3 text-lg font-medium text-primary-foreground hover:bg-primary/90"
      >
        Reintentar
      </button>
    </div>
  )
}
