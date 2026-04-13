export type ConsentCategories = {
  analytics: boolean
  marketing: boolean
}

export type ConsentRecord = {
  categories: ConsentCategories
  timestamp: string
}

const CONSENT_KEY = 'cookie-consent'
const CONSENT_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000 // 12 months

export function getStoredConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(CONSENT_KEY)
  if (!stored) return null
  try {
    const record = JSON.parse(stored) as ConsentRecord
    return record
  } catch {
    return null
  }
}

export function hasConsentExpired(record: ConsentRecord): boolean {
  const storedTime = new Date(record.timestamp).getTime()
  const now = Date.now()
  return now - storedTime > CONSENT_EXPIRY_MS
}

export function isConsentRequired(): boolean {
  const stored = getStoredConsent()
  if (!stored) return true
  return hasConsentExpired(stored)
}

export function saveConsent(categories: ConsentCategories): void {
  const record: ConsentRecord = {
    categories,
    timestamp: new Date().toISOString(),
  }
  localStorage.setItem(CONSENT_KEY, JSON.stringify(record))
}

export function rejectAllConsent(): ConsentCategories {
  return { analytics: false, marketing: false }
}

export function acceptAllConsent(): ConsentCategories {
  return { analytics: true, marketing: true }
}
