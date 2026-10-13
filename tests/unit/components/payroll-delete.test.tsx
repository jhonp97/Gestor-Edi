import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PayrollTable } from '@/components/nomina/payroll-table'
import type { PayrollWithWorker } from '@/types'
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), fetch: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
const pending = { id: 'pending-id', month: 3, year: 2026, periodStart: new Date('2026-03-15'), periodEnd: new Date('2026-04-14'), baseSalary: 100, irpfPercent: 0, irpfAmount: 0, socialSecurityPercent: 0, socialSecurityAmount: 0, otherDeductions: 0, grossPay: 100, netPay: 100, paidAt: null, worker: { id: 'w', name: 'Ana', dni: 'Synthetic', position: 'Driver' } }
const renderList = () => render(<PayrollTable payrolls={[pending, { ...pending, id: 'paid-id', paidAt: new Date('2026-04-15') }] as unknown as PayrollWithWorker[]} />)
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('fetch', mocks.fetch)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  localStorage.clear()
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
})
it('shows deletion for pending documents in desktop/mobile, preserves view actions and hides it for paid documents', () => {
  renderList()
  expect(screen.getAllByRole('button', { name: /Eliminar nómina pendiente de Ana/ })).toHaveLength(2)
  const rows = screen.getAllByRole('row')
  expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/nomina/pending-id')
  expect(within(rows[2]).queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument()
  expect(within(rows[2]).getByRole('link')).toHaveAttribute('href', '/nomina/paid-id')
})
it('confirmation identifies worker and inclusive dates, cancellation does not send a request', async () => {
  const user = userEvent.setup()
  vi.mocked(window.confirm).mockReturnValue(false)
  renderList()
  await user.click(screen.getAllByRole('button', { name: /Eliminar nómina pendiente de Ana/ })[0])
  expect(window.confirm).toHaveBeenCalledWith('¿Eliminar la nómina pendiente de Ana (Del 15/03/2026 al 14/04/2026)? Esta acción no se puede deshacer.')
  expect(mocks.fetch).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
})
it('confirmed deletion uses existing token auth and refreshes only on success', async () => {
  const user = userEvent.setup()
  localStorage.setItem('auth-token', 'synthetic-test-token')
  renderList()
  await user.click(screen.getAllByRole('button', { name: /Eliminar nómina pendiente de Ana/ })[1])
  expect(mocks.fetch).toHaveBeenCalledWith('/api/payroll/pending-id', { method: 'DELETE', headers: { 'x-auth-token': 'synthetic-test-token' } })
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
})
it('blocks duplicate clicks while waiting for the server', async () => {
  const user = userEvent.setup()
  mocks.fetch.mockImplementation(() => new Promise(() => {}))
  renderList()
  const button = screen.getAllByRole('button', { name: /Eliminar nómina pendiente de Ana/ })[0]
  await user.click(button)
  expect(button).toBeDisabled()
  await user.click(button)
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
})
it('server-side paid rejection is visible without pretending the row was removed', async () => {
  const user = userEvent.setup()
  mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'No se puede eliminar una nómina pagada' }) })
  renderList()
  await user.click(screen.getAllByRole('button', { name: /Eliminar nómina pendiente de Ana/ })[0])
  expect(await screen.findByRole('alert')).toHaveTextContent('No se puede eliminar una nómina pagada')
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(screen.getByRole('table')).toBeInTheDocument()
})
it('connection errors preserve the row and reenable deletion', async () => {
  const user = userEvent.setup()
  mocks.fetch.mockRejectedValue(new Error('network failure'))
  renderList()
  const button = screen.getAllByRole('button', { name: /Eliminar nómina pendiente de Ana/ })[0]
  await user.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('Error de conexión al eliminar la nómina')
  expect(button).toBeEnabled()
  expect(mocks.refresh).not.toHaveBeenCalled()
})
