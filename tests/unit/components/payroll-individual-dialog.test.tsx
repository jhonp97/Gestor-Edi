import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
