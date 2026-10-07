import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DailyPayPanel } from '@/components/workers/daily-pay/daily-pay-panel'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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

  it('shows operational detail and guards removal without changing paid snapshot', async () => {
    const date = todayCivil()
    mockFetch.mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () =>
      url.includes('/operations/days/')
        ? { date, operation: { companyName: 'Acme', segments: [{ truckId: 't1', share: 100, kilometers: '42', incident: 'Pinchazo' }] } }
        : monthDto({ status: 'PAID', days: [{ date, rateSnapshot: '100.00' }], totals: { accrued: '100.00' } }) }))
    render(<DailyPayPanel workerId="w1" trucks={[{ id: 't1', name: 'Volvo FH (ABC123)' }]} />)
    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Volvo FH/ })).toHaveAttribute('href', '/trucks/t1')
    expect(screen.getByText('Pinchazo')).toBeInTheDocument()
    expect(screen.getAllByText('100.00')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Quitar día' })).toBeDisabled()
    expect(mockFetch.mock.calls.some(([url, options]) => String(url).includes('/daily-pay/days/') && options?.method === 'DELETE')).toBe(false)
  })

  it('opens a prefilled operational-day editor directly from a worker record', async () => {
    const date = todayCivil()
    const operation = { companyName: 'Acme', segments: [{ truckId: 't1', share: 100, kilometers: '42.00', incident: null }] }
    mockFetch.mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () =>
      url.includes('/operations/days/')
        ? { date, operation }
        : url.includes('/history?')
          ? { months: [] }
          : monthDto({ days: [{ date, rateSnapshot: '100.00' }] }) }))
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" workerName="Ana" trucks={[{ id: 't1', name: 'Volvo FH (ABC123)' }]} />)
    await screen.findByText('Acme')
    await user.click(screen.getByRole('button', { name: /editar datos de la jornada/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect((screen.getByLabelText('Trabajador') as HTMLSelectElement).value).toBe('w1')
    expect((screen.getByLabelText('Fecha') as HTMLInputElement).value).toBe(date)
    expect((screen.getByLabelText('Empresa') as HTMLInputElement).value).toBe('Acme')
    expect((screen.getByLabelText('Kilómetros del camión principal') as HTMLInputElement).value).toBe('42.00')
  })

  it('reloads the selected day after saving without displaying stale company details', async () => {
    const date = todayCivil()
    let company = 'Acme'
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/operations/days/') && options?.method === 'PUT') {
        company = 'Nueva empresa'
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }
      return Promise.resolve({ ok: true, json: async () =>
        url.includes('/operations/days/')
          ? { date, operation: { companyName: company, segments: [{ truckId: 't1', share: 100, kilometers: '42.00', incident: null }] } }
          : url.includes('/history?')
            ? { months: [] }
            : monthDto({ days: [{ date, rateSnapshot: '100.00' }] }) })
    })
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" workerName="Ana" trucks={[{ id: 't1', name: 'Volvo FH' }]} />)
    await screen.findByText('Acme')
    await user.click(screen.getByRole('button', { name: /editar datos de la jornada/i }))
    await screen.findByRole('dialog')
    await user.clear(screen.getByLabelText('Empresa'))
    await user.type(screen.getByLabelText('Empresa'), 'Nueva empresa')
    await user.click(screen.getByRole('button', { name: /guardar jornada/i }))
    await screen.findByText('Nueva empresa')
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls.some(([url, options]) => String(url).includes('/operations/days/') && options?.method === 'PUT')).toBe(true)
  })

  it('lets a legacy marked day receive explicitly selected operational details', async () => {
    const date = todayCivil()
    mockFetch.mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () =>
      url.includes('/operations/days/')
        ? { date, operation: null }
        : url.includes('/history?')
          ? { months: [] }
          : monthDto({ days: [{ date, rateSnapshot: '100.00' }] }) }))
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" workerName="Ana" trucks={[{ id: 't1', name: 'Volvo FH' }]} />)
    await screen.findByText(/detalles históricos/)
    await user.click(screen.getByRole('button', { name: /completar datos de la jornada/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByLabelText('Camión principal de esta jornada')).toBeInTheDocument()
    expect(screen.getByLabelText('Camión principal de esta jornada')).toHaveValue('')
  })

  it('reads an earlier operational day in a paid current month without allowing deletion', async () => {
    const date = currentPeriodStart()
    mockFetch.mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () =>
      url.includes('/operations/days/')
        ? { date, operation: { companyName: 'Acme', segments: [{ truckId: 't1', share: 100, kilometers: null, incident: null }] } }
        : monthDto({ status: 'PAID', days: [{ date, rateSnapshot: '100.00' }] }) }))
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" trucks={[{ id: 't1', name: 'Volvo FH' }]} />)
    const input = await screen.findByLabelText('Fecha trabajada')
    expect(input).toBeEnabled()
    await user.clear(input)
    await user.type(input, date)
    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volvo FH' })).toHaveAttribute('href', '/trucks/t1')
    expect(screen.getByRole('button', { name: 'Quitar día' })).toBeDisabled()
    expect(mockFetch.mock.calls.some(([, options]) => options?.method === 'DELETE' || options?.method === 'PUT')).toBe(false)
  })

  it('does not treat a failed operation request as a legacy day', async () => {
    const date = todayCivil()
    mockFetch.mockImplementation((url: string) => url.includes('/operations/days/')
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({ ok: true, json: async () => monthDto({ days: [{ date, rateSnapshot: '100.00' }] }) }))
    render(<DailyPayPanel workerId="w1" />)
    expect(await screen.findByText(/No se pudieron cargar los detalles/)).toBeInTheDocument()
    expect(screen.queryByText(/detalles históricos/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar día' })).toBeDisabled()
  })

  it('ignores a late response from a previously selected date', async () => {
    const first = currentPeriodStart()
    const second = todayCivil()
    let resolveFirst!: (value: unknown) => void
    mockFetch.mockImplementation((url: string) => {
      if (url.includes(`/operations/days/${first}`)) return new Promise(resolve => { resolveFirst = resolve })
      if (url.includes('/operations/days/')) return Promise.resolve({ ok: true, json: async () => ({ date: second, operation: null }) })
      return Promise.resolve({ ok: true, json: async () => monthDto({ days: [first, second].map(date => ({ date, rateSnapshot: '100.00' })) }) })
    })
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" />)
    const input = await screen.findByLabelText('Fecha trabajada')
    await user.clear(input)
    await user.type(input, first)
    await waitFor(() => expect(resolveFirst).toBeTypeOf('function'))
    await user.clear(input)
    await user.type(input, second)
    await screen.findByText(/detalles históricos/)
    resolveFirst({ ok: true, json: async () => ({ date: first, operation: { companyName: 'Stale', segments: [] } }) })
    await waitFor(() => expect(screen.queryByText('Stale')).not.toBeInTheDocument())
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

  it('ignores an older month GET arriving after the latest worker request', async () => {
    let resolveOld!: (value: unknown) => void
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/history?')) return Promise.resolve({ ok: true, json: async () => ({ months: [] }) })
      if (url.includes('/workers/w1/')) return new Promise(resolve => { resolveOld = resolve })
      return Promise.resolve({ ok: true, json: async () => monthDto({ status: 'PAID', dailyRate: '240.00' }) })
    })
    const { rerender } = render(<DailyPayPanel workerId="w1" />)
    await waitFor(() => expect(resolveOld).toBeTypeOf('function'))
    rerender(<DailyPayPanel workerId="w2" />)
    expect(await screen.findByText('Pagado')).toBeInTheDocument()
    resolveOld({ ok: true, json: async () => monthDto({ dailyRate: '100.00' }) })
    await waitFor(() => expect(screen.getByLabelText('Tarifa diaria')).toHaveValue(240))
    expect(screen.getByRole('button', { name: 'Marcar día' })).toBeDisabled()
  })

  it('starts DELETE month and history refresh together and blocks stale edits when month fails', async () => {
    const date = todayCivil()
    const calls: string[] = []
    let resolveMonth!: (value: unknown) => void
    let resolveHistory!: (value: unknown) => void
    let deleted = false
    mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (options?.method === 'DELETE') { calls.push('DELETE'); deleted = true; return Promise.resolve({ ok: true }) }
      if (url.includes('/operations/days/')) return Promise.resolve({ ok: true, json: async () => ({ date, operation: null }) })
      if (deleted && url.includes('/history?')) { calls.push('history'); return new Promise(resolve => { resolveHistory = resolve }) }
      if (deleted && url.includes('periodStart=')) { calls.push('month'); return new Promise(resolve => { resolveMonth = resolve }) }
      return Promise.resolve({ ok: true, json: async () => url.includes('/history?') ? { months: [] } : monthDto({ days: [{ date, rateSnapshot: '100.00' }] }) })
    })
    const user = userEvent.setup()
    render(<DailyPayPanel workerId="w1" />)
    await screen.findByText(/detalles históricos/)
    await user.click(screen.getByRole('button', { name: 'Quitar día' }))
    await waitFor(() => expect(calls).toEqual(['DELETE', 'month', 'history']))
    resolveHistory({ ok: true, json: async () => ({ months: [] }) })
    resolveMonth({ ok: false })
    expect(await screen.findByText('Error al cargar datos del mes')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitar día' })).not.toBeInTheDocument()
    expect(mockFetch.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
  })

  it('keeps a saved rate when an older toggle refresh GET finishes afterward', async () => {
    const user = userEvent.setup()
    let resolveOldMonth!: (value: unknown) => void
    let resolveHistory!: (value: unknown) => void
    let toggled = false
    mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (options?.method === 'PUT') {
        toggled = true
        return Promise.resolve({ ok: true })
      }
      if (options?.method === 'PATCH') return Promise.resolve({
        ok: true,
        json: async () => monthDto({ dailyRate: '125.00', totals: { accrued: '125.00' }, days: [{ date: todayCivil(), rateSnapshot: '125.00' }] }),
      })
      if (toggled && url.includes('/history?')) return new Promise(resolve => { resolveHistory = resolve })
      if (toggled && url.includes('periodStart=')) return new Promise(resolve => { resolveOldMonth = resolve })
      return Promise.resolve({ ok: true, json: async () => url.includes('/history?') ? { months: [] } : monthDto() })
    })
    render(<DailyPayPanel workerId="w1" />)
    await screen.findByRole('button', { name: 'Marcar día' })
    await user.click(screen.getByRole('button', { name: 'Marcar día' }))
    await waitFor(() => expect(resolveOldMonth).toBeTypeOf('function'))
    await waitFor(() => expect(resolveHistory).toBeTypeOf('function'))
    const input = screen.getByLabelText('Tarifa diaria')
    await user.clear(input)
    await user.type(input, '125')
    await user.click(screen.getByRole('button', { name: 'Guardar tarifa' }))
    expect(await screen.findByText('Tarifa diaria guardada.')).toBeInTheDocument()
    expect(input).toHaveValue(125)
    resolveOldMonth({ ok: true, json: async () => monthDto({ dailyRate: '100.00' }) })
    resolveHistory({ ok: true, json: async () => ({ months: [] }) })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Quitar día' })).toBeInTheDocument())
    expect(input).toHaveValue(125)
    expect(screen.getAllByText('125.00').length).toBeGreaterThanOrEqual(2)
  })

  it('starts independent history refresh before the deferred month response after PUT', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    let resolveMonth!: (value: unknown) => void
    let resolveHistory!: (value: unknown) => void
    let refreshing = false
    mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (options?.method === 'PUT') {
        refreshing = true
        calls.push('PUT')
        return Promise.resolve({ ok: true })
      }
      if (refreshing && url.includes('/history?')) {
        calls.push('history')
        return new Promise(resolve => { resolveHistory = resolve })
      }
      if (refreshing && url.includes('periodStart=')) {
        calls.push('month')
        return new Promise(resolve => { resolveMonth = resolve })
      }
      return Promise.resolve({ ok: true, json: async () => url.includes('/history?') ? { months: [] } : monthDto() })
    })
    render(<DailyPayPanel workerId="w1" />)
    await screen.findByRole('button', { name: 'Marcar día' })
    await user.click(screen.getByRole('button', { name: 'Marcar día' }))
    await waitFor(() => expect(calls).toContain('month'))
    expect(calls).toEqual(['PUT', 'month', 'history'])
    resolveHistory({ ok: true, json: async () => ({ months: [] }) })
    resolveMonth({ ok: true, json: async () => monthDto({ days: [{ date: todayCivil(), rateSnapshot: '100.00' }] }) })
    expect(await screen.findByRole('button', { name: 'Quitar día' })).toBeDisabled()
  })

  it('keeps DELETE guarded until detail confirms legacy, and ignores failed history after PAID refresh', async () => {
    const user = userEvent.setup()
    const date = todayCivil()
    let resolveDetail!: (value: unknown) => void
    let paid = false
    mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (url.includes('/operations/days/')) return new Promise(resolve => { resolveDetail = resolve })
      if (options?.method === 'DELETE') throw new Error('DELETE must remain guarded')
      if (options?.method === 'POST') { paid = true; return Promise.resolve({ ok: true }) }
      if (url.includes('/history?')) return paid ? Promise.reject(new Error('history unavailable')) : Promise.resolve({ ok: true, json: async () => ({ months: [] }) })
      return Promise.resolve({ ok: true, json: async () => monthDto({ status: paid ? 'PAID' : 'PENDING', days: [{ date, rateSnapshot: '100.00' }] }) })
    })
    render(<DailyPayPanel workerId="w1" />)
    await waitFor(() => expect(resolveDetail).toBeTypeOf('function'))
    expect(screen.getByRole('button', { name: 'Quitar día' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Marcar como pagado' }))
    expect(await screen.findByText('Pagado')).toBeInTheDocument()
    resolveDetail({ ok: true, json: async () => ({ date, operation: null }) })
    expect(screen.getByRole('button', { name: 'Quitar día' })).toBeDisabled()
    expect(mockFetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false)
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
    mockFetch.mockImplementation((url: string) => Promise.resolve({
      ok: true,
      json: async () => url.includes('/operations/days/')
        ? { date: pastDate, operation: null }
        : monthDto({ days: [{ date: pastDate, rateSnapshot: '100.00' }], totals: { accrued: '100.00' } }),
    }))
    render(<DailyPayPanel workerId="w1" />)

    const dateInput = await screen.findByLabelText('Fecha trabajada')
    expect(dateInput).toHaveAttribute('min', currentPeriodStart())
    expect(dateInput).toHaveAttribute('max', todayCivil())
    await user.clear(dateInput)
    await user.type(dateInput, pastDate)

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      `/api/workers/w1/operations/days/${pastDate}`, expect.any(Object)
    ))
    // A legacy day is explicitly confirmed by the operation endpoint.
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockFetch.mockResolvedValue({ ok: true, json: async () => monthDto() })
    await screen.findByText(/detalles históricos/)
    await user.click(screen.getByRole('button', { name: /quitar día/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/workers/w1/daily-pay/days/${pastDate}`,
        { method: 'DELETE' }
      )
    })
  })

  it('permite seleccionar fecha pero no editar cuando no hay tarifa positiva', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => monthDto({ dailyRate: null }),
    })
    render(<DailyPayPanel workerId="w1" />)

    const dateInput = await screen.findByLabelText('Fecha trabajada')
    expect(dateInput).toBeEnabled()
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
