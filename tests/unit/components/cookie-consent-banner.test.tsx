import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CookieConsentBanner } from '@/components/layout/cookie-consent-banner'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    reload: vi.fn(),
  }),
}))

const user = userEvent.setup()

describe('T1.7: CookieConsentBanner Component', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('renders', () => {
    it('debería renderizar el banner cuando no hay consentimiento previo', () => {
      render(<CookieConsentBanner />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('debería mostrar el título de banner de cookies', () => {
      render(<CookieConsentBanner />)
      expect(screen.getByText(/configuración de cookies/i)).toBeInTheDocument()
    })

    it('debería mostrar descripción de cookies', () => {
      render(<CookieConsentBanner />)
      expect(screen.getByText(/Utilizamos cookies/i)).toBeInTheDocument()
    })
  })

  describe('toggles', () => {
    it('debería mostrar toggle para cookies esenciales (bloqueado)', () => {
      render(<CookieConsentBanner />)
      const essentialToggle = screen.getByRole('checkbox', { name: /esenciales/i })
      expect(essentialToggle).toBeInTheDocument()
      expect(essentialToggle).toBeDisabled()
    })

    it('debería mostrar toggle para cookies analíticas', () => {
      render(<CookieConsentBanner />)
      const analyticsToggle = screen.getByRole('checkbox', { name: /analíticas/i })
      expect(analyticsToggle).toBeInTheDocument()
      expect(analyticsToggle).not.toBeDisabled()
    })

    it('debería mostrar toggle para cookies de marketing', () => {
      render(<CookieConsentBanner />)
      const marketingToggle = screen.getByRole('checkbox', { name: /marketing/i })
      expect(marketingToggle).toBeInTheDocument()
      expect(marketingToggle).not.toBeDisabled()
    })
  })

  describe('actions', () => {
    it('debería tener botón de aceptar todo', () => {
      render(<CookieConsentBanner />)
      expect(screen.getByRole('button', { name: /aceptar todo/i })).toBeInTheDocument()
    })

    it('debería tener botón de rechazar todo', () => {
      render(<CookieConsentBanner />)
      expect(screen.getByRole('button', { name: /rechazar todo/i })).toBeInTheDocument()
    })

    it('debería tener botón de guardar preferencias', () => {
      render(<CookieConsentBanner />)
      expect(screen.getByRole('button', { name: /guardar preferencias/i })).toBeInTheDocument()
    })

    it('debería tener enlace a política de privacidad', () => {
      render(<CookieConsentBanner />)
      const privacyLink = screen.getByRole('link', { name: /política de privacidad/i })
      expect(privacyLink).toBeInTheDocument()
      expect(privacyLink).toHaveAttribute('href', '/privacy')
    })
  })

  describe('consent logic', () => {
    it('debería guardar consentimiento completo al aceptar todo', async () => {
      render(<CookieConsentBanner />)
      const acceptButton = screen.getByRole('button', { name: /aceptar todo/i })
      await user.click(acceptButton)
      expect(localStorage.getItem('cookie-consent')).toBeTruthy()
    })

    it('NO debería renderizar si ya existe consentimiento en localStorage', () => {
      // Set consent in localStorage
      const existingConsent = {
        categories: { analytics: true, marketing: false },
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem('cookie-consent', JSON.stringify(existingConsent))
      render(<CookieConsentBanner />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
