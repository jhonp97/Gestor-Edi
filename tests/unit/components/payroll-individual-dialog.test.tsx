import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PayrollIndividualDialog } from '@/components/nomina/payroll-individual-dialog'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('PayrollIndividualDialog', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  const worker = { id: 'w', name: 'Ana', position: 'Conductora', baseSalary: 2100 }
  const rangeResponse = { days: [{ date: '2026-03-15', rateSnapshot: '125.50' }], totals: { accrued: '125.50' } }

  it('defaults to a complete calendar month and submits an editable cross-month period', async () => {
    const user = userEvent.setup()
    mockFetch.mockImplementation(async (_url: string, options?: RequestInit) => ({ ok: true, json: async () => options?.method === 'POST' ? { id: 'new' } : rangeResponse }))
    render(<PayrollIndividualDialog preselectedWorker={worker} />)
    await user.click(screen.getByRole('button', { name: 'Generar Nómina' }))
    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } })
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-02-01')
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-02-28')
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-04-14' } })
    await screen.findByText(/Acumulado diario del intervalo: €125.50/)
    expect(screen.getByLabelText('Salario Base (€)')).toHaveValue(125.5)
    expect(screen.getByText(/1 día trabajado/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Salario Base (€)'), { target: { value: '150' } })
    await user.click(screen.getAllByRole('button', { name: 'Generar Nómina' }).at(-1)!)
    const posted = mockFetch.mock.calls.find(([, options]) => options?.method === 'POST')
    expect(JSON.parse(posted![1].body)).toMatchObject({ workerId: 'w', month: 3, year: 2026, periodStart: '2026-03-15', periodEnd: '2026-04-14', baseSalary: 150, irpfPercent: 0, socialSecurityPercent: 0 })
  })

  it('clears an old accrual and prevents submitting stale salary while a new range loads', async () => {
    const user = userEvent.setup()
    let finish: (value: unknown) => void = () => {}
    mockFetch.mockResolvedValue({ ok: true, json: async () => rangeResponse })
    render(<PayrollIndividualDialog preselectedWorker={worker} />)
    await user.click(screen.getByRole('button', { name: 'Generar Nómina' }))
    await screen.findByText(/Acumulado diario del intervalo/)
    mockFetch.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-12-31' } })
    expect(screen.queryByText(/Acumulado diario del intervalo/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Generar Nómina' }).at(-1)).toBeDisabled()
    finish({ ok: false, json: async () => ({ error: 'No disponible' }) })
    await waitFor(() => expect(screen.getByText(/No se pudo cargar/)).toBeInTheDocument())
    expect(screen.getByLabelText('Salario Base (€)')).not.toHaveValue(125.5)
  })

  it('muestra una etiqueta humana y conserva el identificador solo como valor', async () => {
    const user = userEvent.setup()
    const technicalDocument = 'encrypted-worker-document'

    mockFetch.mockResolvedValue({
      json: async () => ([{
        id: 'worker-id',
        name: 'María García',
        dni: technicalDocument,
        position: 'Conductora',
        baseSalary: 2100,
        status: 'ACTIVE',
      }]),
    })

    render(<PayrollIndividualDialog />)
    await user.click(screen.getByRole('button', { name: 'Nómina Individual' }))

    const option = await screen.findByRole('option', { name: 'María García' })
    expect(option).toHaveValue('worker-id')
    expect(screen.queryByText(technicalDocument, { exact: false })).not.toBeInTheDocument()
  })

  it('usa un fallback seguro cuando falta el nombre', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValue({
      json: async () => ([{
        id: 'worker-without-name',
        name: '   ',
        dni: 'encrypted-worker-document',
        position: 'Conductora',
        baseSalary: 2100,
        status: 'ACTIVE',
      }]),
    })

    render(<PayrollIndividualDialog />)
    await user.click(screen.getByRole('button', { name: 'Nómina Individual' }))

    expect(await screen.findByRole('option', { name: 'Trabajador sin nombre' })).toHaveValue('worker-without-name')
  })
})
