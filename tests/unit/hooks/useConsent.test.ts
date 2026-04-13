import { describe, it, expect, beforeEach } from 'vitest'
import {
  getStoredConsent,
  hasConsentExpired,
  isConsentRequired,
  saveConsent,
  rejectAllConsent,
  acceptAllConsent,
  type ConsentCategories,
} from '@/hooks/useConsent'

// Setup jsdom localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('T1.8: useConsent Hook (localStorage logic)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getStoredConsent', () => {
    it('debería retornar null si no existe consentimiento', () => {
      expect(getStoredConsent()).toBeNull()
    })

    it('debería retornar el consentimiento almacenado', () => {
      const consent = {
        categories: { analytics: true, marketing: false },
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem('cookie-consent', JSON.stringify(consent))
      const result = getStoredConsent()
      expect(result).not.toBeNull()
      expect(result?.categories.analytics).toBe(true)
      expect(result?.categories.marketing).toBe(false)
    })

    it('debería retornar null si el JSON es inválido', () => {
      localStorage.setItem('cookie-consent', 'not-json')
      expect(getStoredConsent()).toBeNull()
    })
  })

  describe('hasConsentExpired', () => {
    it('debería retornar false para consentimiento reciente', () => {
      const record = {
        categories: { analytics: true, marketing: false },
        timestamp: new Date().toISOString(),
      }
      expect(hasConsentExpired(record)).toBe(false)
    })

    it('debería retornar true para consentimiento de más de 12 meses', () => {
      const oldDate = new Date()
      oldDate.setMonth(oldDate.getMonth() - 13)
      const record = {
        categories: { analytics: true, marketing: false },
        timestamp: oldDate.toISOString(),
      }
      expect(hasConsentExpired(record)).toBe(true)
    })
  })

  describe('isConsentRequired', () => {
    it('debería retornar true cuando no hay consentimiento', () => {
      expect(isConsentRequired()).toBe(true)
    })

    it('debería retornar false cuando hay consentimiento vigente', () => {
      const consent = {
        categories: { analytics: true, marketing: false },
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem('cookie-consent', JSON.stringify(consent))
      expect(isConsentRequired()).toBe(false)
    })

    it('debería retornar true cuando el consentimiento expiró', () => {
      const oldDate = new Date()
      oldDate.setMonth(oldDate.getMonth() - 13)
      const consent = {
        categories: { analytics: true, marketing: false },
        timestamp: oldDate.toISOString(),
      }
      localStorage.setItem('cookie-consent', JSON.stringify(consent))
      expect(isConsentRequired()).toBe(true)
    })
  })

  describe('saveConsent', () => {
    it('debería guardar consentimiento en localStorage', () => {
      const categories: ConsentCategories = { analytics: true, marketing: false }
      saveConsent(categories)
      const stored = localStorage.getItem('cookie-consent')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.categories.analytics).toBe(true)
      expect(parsed.categories.marketing).toBe(false)
      expect(parsed.timestamp).toBeTruthy()
    })
  })

  describe('rejectAllConsent', () => {
    it('debería retornar todas las categorías en false', () => {
      const result = rejectAllConsent()
      expect(result.analytics).toBe(false)
      expect(result.marketing).toBe(false)
    })
  })

  describe('acceptAllConsent', () => {
    it('debería retornar todas las categorías en true', () => {
      const result = acceptAllConsent()
      expect(result.analytics).toBe(true)
      expect(result.marketing).toBe(true)
    })
  })
})
