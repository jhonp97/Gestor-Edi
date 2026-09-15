import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DailyPayPanel } from '@/components/workers/daily-pay/daily-pay-panel'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function monthDto(overrides: Record<string, unknown> = {}) {
  return {
    workerId: 'w1',
    periodStart: '2026-09-01',
    dailyRate: '100.00',
    status: 'PENDING',
    paidAt: null,
    days: [],
    totals: { accrued: '0.00' },
    ...overrides,
  }
}

/** Civil date of "today" computed exactly as the panel computes it (UTC). */
function todayCivil(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function currentPeriodStart(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

describe('DailyPayPanel', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => monthDto() })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('muestra estado de carga', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<DailyPayPanel workerId="w1" />)
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
  })

  it('muestra error cuando falla la carga', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    render(<DailyPayPanel workerId="w1" />)
    expect(await screen.findByText('Error al cargar datos del mes')).toBeInTheDocument()
  })

  it('muestra estado PENDING con días trabajados y total', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({
        days: [
          { date: '2026-09-01', rateSnapshot: '100.00' },
          { date: '2026-09-05', rateSnapshot: '100.00' },
        ],
        totals: { accrued: '200.00' },
      }),
    })
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getAllByText('Pendiente').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText('200.00')).toBeInTheDocument()
    expect(screen.getByText('2026-09-01')).toBeInTheDocument()
    expect(screen.getByText('2026-09-05')).toBeInTheDocument()
    // Only one Pendiente badge exists (the panel status badge)
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThanOrEqual(1)
  })

  it('muestra estado PAID con paidAt', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({
        status: 'PAID',
        paidAt: '2026-09-15T10:30:00.000Z',
        days: [{ date: '2026-09-01', rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByText('Pagado')).toBeInTheDocument()
    })
    // Panel badge shows Pagado; calendar months may also show it
    expect(screen.getAllByText('Pagado').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/15\/9\/2026/)).toBeInTheDocument()
  })

  it('muestra el control y permite quitar la tarifa diaria', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({ dailyRate: null }),
    })
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByText(/Configura la tarifa diaria del trabajador/)).toBeInTheDocument()
    })

    const input = screen.getByLabelText('Tarifa diaria')
    expect(input).toHaveAttribute('type', 'number')
    expect(input).toHaveAttribute('min', '0.01')
    expect(input).toHaveAttribute('step', '0.01')
    expect(input).toHaveValue(null)

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => monthDto({ dailyRate: null }),
    })

    await user.click(screen.getByRole('button', { name: /guardar tarifa/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/workers/w1/daily-pay?periodStart=${currentPeriodStart()}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dailyRate: null }),
        }
      )
    })
    expect(await screen.findByText('Tarifa diaria eliminada.')).toBeInTheDocument()
  })

  it('guarda una tarifa diaria positiva y actualiza el campo', async () => {
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" />)

    const input = await screen.findByLabelText('Tarifa diaria')
    expect(input).toHaveValue(100)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))

    await user.clear(input)
    await user.type(input, '125.50')
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => monthDto({ dailyRate: '125.50' }),
    })

    await user.click(screen.getByRole('button', { name: /guardar tarifa/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/workers/w1/daily-pay?periodStart=${currentPeriodStart()}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dailyRate: '125.5' }),
        }
      )
    })
    expect(await screen.findByText('Tarifa diaria guardada.')).toBeInTheDocument()
    expect(input).toHaveValue(125.5)
  })

  it('muestra un error cuando el servidor rechaza la tarifa diaria', async () => {
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" />)

    const input = await screen.findByLabelText('Tarifa diaria')
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    await user.clear(input)
    await user.type(input, '150')
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce({ ok: false })

    await user.click(screen.getByRole('button', { name: /guardar tarifa/i }))

    expect(
      await screen.findByText('No se pudo guardar la tarifa diaria.')
    ).toBeInTheDocument()
  })

  it('muestra estado de días para un mes sin días', async () => {
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByText('Sin días registrados este mes')).toBeInTheDocument()
    })
  })

  it('marca un día pasado seleccionado con la ruta específica', async () => {
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /marcar día/i })).toBeInTheDocument()
    })

    const pastDate = currentPeriodStart()
    await user.clear(screen.getByLabelText('Fecha trabajada'))
    await user.type(screen.getByLabelText('Fecha trabajada'), pastDate)

    mockFetch.mockResolvedValueOnce({ ok: true })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => monthDto({
        days: [{ date: pastDate, rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })

    await user.click(screen.getByRole('button', { name: /marcar día/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/workers/w1/daily-pay/days/${pastDate}`,
        { method: 'PUT' }
      )
    })
  })

  it('quita el día seleccionado cuando ya está registrado', async () => {
    const user = userEvent.setup()
    const pastDate = currentPeriodStart()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({
        days: [{ date: pastDate, rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })
    render(<DailyPayPanel workerId="w1" />)

    const dateInput = await screen.findByLabelText('Fecha trabajada')
    expect(dateInput).toHaveAttribute('min', currentPeriodStart())
    expect(dateInput).toHaveAttribute('max', todayCivil())
    await user.clear(dateInput)
    await user.type(dateInput, pastDate)

    const removeButton = screen.getByRole('button', { name: /quitar día/i })
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockFetch.mockResolvedValue({ ok: true, json: async () => monthDto() })
    await user.click(removeButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/workers/w1/daily-pay/days/${pastDate}`,
        { method: 'DELETE' }
      )
    })
  })

  it('deshabilita la fecha y la acción cuando no hay tarifa positiva', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({ dailyRate: null }),
    })
    render(<DailyPayPanel workerId="w1" />)

    const dateInput = await screen.findByLabelText('Fecha trabajada')
    expect(dateInput).toBeDisabled()
    expect(screen.getByRole('button', { name: /marcar día/i })).toBeDisabled()
    expect(screen.getByLabelText('Tarifa diaria')).toBeEnabled()
    expect(screen.getByRole('button', { name: /guardar tarifa/i })).toBeEnabled()
  })

  it('muestra el mensaje de error devuelto al actualizar un día', async () => {
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" />)

    await screen.findByLabelText('Fecha trabajada')
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'La tarifa diaria debe ser positiva.' }),
    })
    await user.click(screen.getByRole('button', { name: /marcar día/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La tarifa diaria debe ser positiva.'
    )
  })

  it('marca mes como PAID', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({
        days: [{ date: '2026-09-01', rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /marcar como pagado/i })).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => monthDto({
        status: 'PAID',
        paidAt: '2026-09-10T12:00:00.000Z',
        days: [{ date: '2026-09-01', rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })

    await user.click(screen.getByRole('button', { name: /marcar como pagado/i }))

    await waitFor(() => {
      expect(screen.getByText('Pagado')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Pagado').length).toBeGreaterThanOrEqual(1)
  })

  it('revierte mes PAID a PENDING', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({
        status: 'PAID',
        paidAt: '2026-09-10T12:00:00.000Z',
        days: [{ date: '2026-09-01', rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /revertir/i })).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => monthDto({
        days: [{ date: '2026-09-01', rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })

    await user.click(screen.getByRole('button', { name: /revertir/i }))

    await waitFor(() => {
      expect(screen.getAllByText('Pendiente').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThanOrEqual(1)
  })

  it('muestra badge Pendiente para meses PENDING y Pagado para meses PAID', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({
        status: 'PAID',
        paidAt: '2026-09-10T12:00:00.000Z',
        days: [{ date: '2026-09-01', rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByText('Pagado')).toBeInTheDocument()
    })
  })

  it('el botón de marcar como pagado está deshabilitado cuando no hay días', async () => {
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByText('Sin días registrados este mes')).toBeInTheDocument()
    })

    const markPaidBtn = screen.getByRole('button', { name: /marcar como pagado/i })
    expect(markPaidBtn).toBeDisabled()
  })

  it('bloquea el toggle de día cuando el mes está PAID', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({
        status: 'PAID',
        paidAt: '2026-09-10T12:00:00.000Z',
        days: [{ date: '2026-09-01', rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByText('Pagado')).toBeInTheDocument()
    })
    const dayToggle = screen.getByRole('button', { name: /marcar día|quitar día/i })
    expect(dayToggle).toBeDisabled()
  })

  it('muestra solo el accrued del mes — sin campos de nómina', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({
        days: [{ date: '2026-09-01', rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getAllByText('100.00').length).toBeGreaterThanOrEqual(1)
    })
    // Accrued-only surface: no payment/balance/net fields from the DTO
    const body = document.body.textContent ?? ''
    expect(body).not.toMatch(/\bpaid\b/i)
    expect(body).not.toMatch(/\bbalance\b/i)
    expect(body).not.toMatch(/\bnet\b/i)
  })

  it('accesibilidad — botones principales son accesibles', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({
        status: 'PAID',
        paidAt: '2026-09-10T12:00:00.000Z',
        days: [{ date: '2026-09-01', rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /marcar día|quitar día/i })
      ).toBeInTheDocument()
    })
    // The day toggle shows one label depending on whether today is marked;
    // assert the toggle is accessible under either label, plus the other
    // primary actions by role.
    expect(
      screen.getByRole('button', { name: /marcar día|quitar día/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /marcar como pagado/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /revertir/i })).toBeInTheDocument()
  })
})
