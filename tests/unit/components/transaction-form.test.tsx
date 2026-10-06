import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransactionForm } from '@/components/transactions/transaction-form'
import type { Truck } from '@/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

const truck = {
  id: 'truck-id',
  plate: '1234-ABC',
  brand: 'Volvo',
  model: 'FH',
} as Truck

describe('TransactionForm', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it.each([0, 100])('keeps a fixed truck read-only across reset and submits both transaction types (response delay: %i ms)', async (responseDelay) => {
    const user = userEvent.setup()
    // A request starting is not a completed submission: exercise both response timings.
    mockFetch.mockImplementation(() => responseDelay === 0
      ? Promise.resolve({ ok: true })
      : new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true }), responseDelay)
      }))
    const otherTruck = { ...truck, id: 'other-truck', plate: '9999-XYZ' }
    render(<TransactionForm trucks={[truck, otherTruck]} fixedTruckId={truck.id} />)

    for (const type of ['INCOME', 'EXPENSE'] as const) {
      await user.click(screen.getByRole('button', { name: 'Agregar Transacción' }))
      expect(screen.getByText(/1234-ABC.*Volvo FH/)).toBeInTheDocument()
      expect(screen.queryByLabelText('Camión', { selector: 'select' })).not.toBeInTheDocument()
      expect(screen.queryByText(/9999-XYZ/)).not.toBeInTheDocument()
      expect(screen.getByLabelText('Tipo')).toHaveValue('EXPENSE')
      expect(screen.getByLabelText('Monto (€)')).toHaveValue(null)
      expect(screen.getByLabelText('Descripción')).toHaveValue('')
      await user.selectOptions(screen.getByLabelText('Tipo'), type)
      await user.type(screen.getByLabelText('Monto (€)'), '125')
      await user.click(screen.getByLabelText('Descripción'))
      await user.paste('Servicio real')
      await user.click(screen.getByRole('button', { name: 'Guardar Transacción' }))
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(type === 'INCOME' ? 1 : 2))
      const body = JSON.parse(mockFetch.mock.calls.at(-1)![1].body)
      expect(body.truckId).toBe(truck.id)
      expect(body.type).toBe(type)
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Nueva Transacción', hidden: true })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Agregar Transacción' })).toHaveAttribute('aria-expanded', 'false')
      })
    }
  })

  it('ofrece sugerencias coherentes con el tipo sin cerrar la entrada', async () => {
    const user = userEvent.setup()
    render(<TransactionForm trucks={[truck]} />)

    await user.click(screen.getByRole('button', { name: 'Agregar Transacción' }))

    const category = screen.getByLabelText('Categoría')
    const suggestions = screen.getByRole('listbox', { hidden: true })
    expect(category).toHaveAttribute('list', 'tx-category-suggestions')
    expect(suggestions.querySelector('option[value="Combustible"]')).toBeInTheDocument()
    expect(suggestions.querySelector('option[value="Impuestos"]')).toBeInTheDocument()
    expect(suggestions.querySelector('option[value="Reparaciones"]')).toBeInTheDocument()
    expect(suggestions.querySelector('option[value="Salarios"]')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Tipo'), 'INCOME')

    expect(suggestions.querySelector('option[value="Servicios de transporte"]')).toBeInTheDocument()
    expect(suggestions.querySelector('option[value="Combustible"]')).not.toBeInTheDocument()
  })

  it('envía una categoría personalizada sin cambiar el payload', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({ ok: true })
    render(<TransactionForm trucks={[truck]} />)

    await user.click(screen.getByRole('button', { name: 'Agregar Transacción' }))
    await user.selectOptions(screen.getByLabelText('Camión'), 'truck-id')
    await user.type(screen.getByLabelText('Monto (€)'), '125')
    await user.type(screen.getByLabelText('Descripción'), 'Gasto extraordinario')
    await user.type(screen.getByLabelText('Categoría'), 'Formación especializada')
    await user.click(screen.getByRole('button', { name: 'Guardar Transacción' }))

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.category).toBe('Formación especializada')
  })
})
