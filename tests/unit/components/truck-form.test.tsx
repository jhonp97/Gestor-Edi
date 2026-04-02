import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TruckForm } from '@/components/trucks/truck-form'

// Mock fetch for form submission
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('TruckForm', () => {
  const user = userEvent.setup()

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
    expect(screen.getByRole('button', { name: /Guardar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument()
  })

  it('debería enviar el formulario con datos válidos', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    // Mock window.location.reload
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    })

    render(<TruckForm />)

    await user.click(screen.getByRole('button', { name: /Agregar Camión/i }))

    await user.type(screen.getByLabelText(/Matrícula/i), 'ABC-123')
    await user.type(screen.getByLabelText(/Marca/i), 'Volvo')
    await user.type(screen.getByLabelText(/Modelo/i), 'FH16')

    await user.click(screen.getByRole('button', { name: /Guardar/i }))

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
    await user.click(screen.getByRole('button', { name: /Cancelar/i }))

    expect(screen.queryByLabelText(/Matrícula/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agregar Camión/i })).toBeInTheDocument()
  })

  it('debería requerir campos obligatorios', async () => {
    render(<TruckForm />)

    await user.click(screen.getByRole('button', { name: /Agregar Camión/i }))

    const plateInput = screen.getByLabelText(/Matrícula/i)
    const brandInput = screen.getByLabelText(/Marca/i)
    const modelInput = screen.getByLabelText(/Modelo/i)
    const yearInput = screen.getByLabelText(/Año/i)

    expect(plateInput).toBeRequired()
    expect(brandInput).toBeRequired()
    expect(modelInput).toBeRequired()
    expect(yearInput).toBeRequired()
  })
})
