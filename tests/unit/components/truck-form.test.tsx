import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TruckForm } from '@/components/trucks/truck-form'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('TruckForm', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('debería renderizar el botón de agregar camión inicialmente', () => {
    render(<TruckForm />)
    expect(screen.getByRole('button', { name: /Agregar Camión/i })).toBeInTheDocument()
  })

  it('debería mostrar el formulario al hacer clic en Agregar Camión', async () => {
    render(<TruckForm />)

    await user.click(screen.getByRole('button', { name: /Agregar Camión/i }))

    expect(screen.getByLabelText(/Matrícula/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Marca/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Modelo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Año/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar Camión/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument()
  })

  it('debería enviar el formulario con datos válidos', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', plate: 'ABC-123', brand: 'Volvo', model: 'FH16' }),
    })

    render(<TruckForm />)

    await user.click(screen.getByRole('button', { name: /Agregar Camión/i }))

    await user.type(screen.getByLabelText(/Matrícula/i), 'ABC-123')
    await user.type(screen.getByLabelText(/Marca/i), 'Volvo')
    await user.type(screen.getByLabelText(/Modelo/i), 'FH16')

    await user.click(screen.getByRole('button', { name: /Guardar Camión/i }))

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/trucks')
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    const body = JSON.parse(options.body)
    expect(body.plate).toBe('ABC-123')
    expect(body.brand).toBe('Volvo')
    expect(body.model).toBe('FH16')
    expect(body.year).toBe(new Date().getFullYear())
  })

  it('debería cerrar el formulario al hacer clic en Cancelar', async () => {
    render(<TruckForm />)

    await user.click(screen.getByRole('button', { name: /Agregar Camión/i }))

    expect(screen.getByLabelText(/Matrícula/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cancelar/i }))

    expect(screen.queryByLabelText(/Matrícula/i)).not.toBeInTheDocument()
  })

  it('debería requerir campos obligatorios', async () => {
    render(<TruckForm />)

    await user.click(screen.getByRole('button', { name: /Agregar Camión/i }))

    expect(screen.getByLabelText(/Matrícula/i)).toBeRequired()
    expect(screen.getByLabelText(/Marca/i)).toBeRequired()
    expect(screen.getByLabelText(/Modelo/i)).toBeRequired()
    expect(screen.getByLabelText(/Año/i)).toBeRequired()
  })
})