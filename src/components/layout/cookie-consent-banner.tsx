'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import {
  isConsentRequired,
  saveConsent,
  acceptAllConsent,
  rejectAllConsent,
  type ConsentCategories,
} from '@/hooks/useConsent'

interface CookieConsentBannerProps {
  onConsentChange?: (categories: ConsentCategories) => void
}

export function CookieConsentBanner({ onConsentChange }: CookieConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isConsentRequired()) {
      setIsVisible(true)
    }
  }, [])

  async function handleAcceptAll() {
    const categories = acceptAllConsent()
    saveConsent(categories)
    setIsSubmitting(true)
    await sendConsentToApi(categories)
    setIsVisible(false)
    onConsentChange?.(categories)
    setIsSubmitting(false)
  }

  async function handleRejectAll() {
    const categories = rejectAllConsent()
    saveConsent(categories)
    setIsSubmitting(true)
    await sendConsentToApi(categories)
    setIsVisible(false)
    onConsentChange?.(categories)
    setIsSubmitting(false)
  }

  async function handleSave() {
    const categories: ConsentCategories = { analytics, marketing }
    saveConsent(categories)
    setIsSubmitting(true)
    await sendConsentToApi(categories)
    setIsVisible(false)
    onConsentChange?.(categories)
    setIsSubmitting(false)
  }

  async function sendConsentToApi(categories: ConsentCategories) {
    try {
      await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories }),
      })
    } catch {
      // Non-blocking: consent stored locally regardless of API status
    }
  }

  if (!isVisible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-0 bottom-0 z-50 p-4 md:left-auto md:right-4 md:bottom-4 md:w-96 md:p-0"
    >
      <div className="relative rounded-lg border border-border bg-card shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleRejectAll}
          className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Cerrar banner de cookies"
        >
          <X className="size-4" />
        </button>

        <div className="p-6">
          <h2
            id="cookie-banner-title"
            className="mb-2 text-lg font-semibold text-foreground"
          >
            Configuración de Cookies
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Utilizamos cookies y tecnologías similares para garantizar el funcionamiento de la Plataforma, analizar el uso y mejorar la experiencia. Puedes elegir qué categorías de cookies aceptas.
          </p>

          <div className="mb-4 space-y-3">
            {/* Essential cookies - always on, not dismissible */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Cookies Esenciales</p>
                <p className="text-xs text-muted-foreground">
                  Requeridas para el funcionamiento de la Plataforma
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="peer sr-only"
                  aria-label="Cookies esenciales"
                />
                <div className="peer-checked:bg-primary h-5 w-9 rounded-full bg-muted-foreground/30 peer-checked:peer-disabled:bg-primary peer-disabled:opacity-50" />
                <div className="pointer-events-none absolute start-0.5 top-0.5 size-4 rounded-full bg-white transition peer-checked:translate-x-4" />
              </label>
            </div>

            {/* Analytics cookies */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Cookies Analíticas</p>
                <p className="text-xs text-muted-foreground">
                  Nos ayudan a entender cómo usas la Plataforma
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="peer sr-only"
                  aria-label="Cookies analíticas"
                />
                <div className="peer-checked:bg-primary h-5 w-9 rounded-full bg-muted-foreground/30 peer-checked:bg-primary" />
                <div className="pointer-events-none absolute start-0.5 top-0.5 size-4 rounded-full bg-white transition peer-checked:translate-x-4" />
              </label>
            </div>

            {/* Marketing cookies */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Cookies de Marketing</p>
                <p className="text-xs text-muted-foreground">
                  Utilizadas para publicidad relevante
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="peer sr-only"
                  aria-label="Cookies de marketing"
                />
                <div className="peer-checked:bg-primary h-5 w-9 rounded-full bg-muted-foreground/30 peer-checked:bg-primary" />
                <div className="pointer-events-none absolute start-0.5 top-0.5 size-4 rounded-full bg-white transition peer-checked:translate-x-4" />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleRejectAll}
              disabled={isSubmitting}
              className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Rechazar todo
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Guardar preferencias
            </button>
            <button
              onClick={handleAcceptAll}
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Aceptar todo
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Al usar la Plataforma, aceptas nuestra{' '}
            <Link href="/terms" className="text-primary underline hover:text-primary/80">
              Política de Cookies
            </Link>{' '}
            y{' '}
            <Link href="/privacy" className="text-primary underline hover:text-primary/80">
              Política de Privacidad
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
