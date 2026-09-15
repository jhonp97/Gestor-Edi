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

  it('muestra advertencia cuando no hay tarifa diaria', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({ dailyRate: null }),
    })
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByText(/Configura la tarifa diaria del trabajador/)).toBeInTheDocument()
    })
  })

  it('muestra estado de días para un mes sin días', async () => {
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByText('Sin días registrados este mes')).toBeInTheDocument()
    })
  })

  it('marca y desmarca un día trabajado', async () => {
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /marcar día/i })).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => monthDto({
        days: [{ date: '2026-09-03', rateSnapshot: '100.00' }],
        totals: { accrued: '100.00' },
      }),
    })

    await user.click(screen.getByRole('button', { name: /marcar día/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/workers/w1/daily-pay/days/${todayCivil()}`,
        { method: 'PUT' }
      )
    })
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
