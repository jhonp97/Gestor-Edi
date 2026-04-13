import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from '@/components/layout/footer'

// Mock lucide-react icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react')
  return {
    ...actual,
  }
})

describe('T1.5: Footer Component', () => {
  it('debería renderizar el footer', () => {
    render(<Footer />)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('debería contener enlace a política de privacidad', () => {
    render(<Footer />)
    const privacyLink = screen.getByRole('link', { name: /política de privacidad/i })
    expect(privacyLink).toBeInTheDocument()
    expect(privacyLink).toHaveAttribute('href', '/privacy')
  })

  it('debería contener enlace a términos y condiciones', () => {
    render(<Footer />)
    const termsLink = screen.getByRole('link', { name: /términos y condiciones/i })
    expect(termsLink).toBeInTheDocument()
    expect(termsLink).toHaveAttribute('href', '/terms')
  })

  it('debería contener enlace a aviso legal', () => {
    render(<Footer />)
    const legalLink = screen.getByRole('link', { name: /aviso legal/i })
    expect(legalLink).toBeInTheDocument()
    expect(legalLink).toHaveAttribute('href', '/legal-notice')
  })

  it('debería contener el nombre de la empresa', () => {
    render(<Footer />)
    // "Flota Camiones" appears in both brand name and copyright line
    expect(screen.getAllByText(/flota camiones/i)).toHaveLength(2)
  })

  it('debería contener copyright con año actual', () => {
    render(<Footer />)
    const currentYear = new Date().getFullYear().toString()
    expect(screen.getByText(new RegExp(currentYear))).toBeInTheDocument()
  })
})
