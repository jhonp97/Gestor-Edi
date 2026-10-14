import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

const mocks = vi.hoisted(() => ({ pathname: '/facturas', get: vi.fn().mockResolvedValue({}) }))
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))
vi.mock('@/hooks/use-api', () => ({ useApi: () => ({ get: mocks.get }) }))
vi.mock('@/lib/offline', () => ({ clearOfflineToken: vi.fn() }))

describe('Navegación de facturas', () => {
  it('muestra Facturas inmediatamente después de Nómina y cierra el menú móvil', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    const links = screen.getAllByRole('link')
    const payroll = links.findIndex(link => link.textContent === 'Nómina')
    expect(links[payroll + 1]).toHaveTextContent('Facturas')
    expect(links[payroll + 1]).toHaveAttribute('href', '/facturas')
    expect(links[payroll + 1]).toHaveAttribute('aria-current', 'page')
    fireEvent.click(links[payroll + 1])
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeInTheDocument()
    cleanup()
  })
  it('muestra el título de Facturas y mantiene el título de Nómina', () => {
    render(<Header />)
    expect(screen.getByText('Facturas')).toBeInTheDocument()
    cleanup()
    mocks.pathname = '/nomina'
    render(<Header />)
    expect(screen.getByText('Nómina')).toBeInTheDocument()
    cleanup()
    mocks.pathname = '/facturas'
  })
})
