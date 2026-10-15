import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TruckDeleteButton } from '@/components/trucks/truck-delete-button'

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), fetch: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mocks.fetch)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const clickDelete = async () => {
  render(<TruckDeleteButton truckId="truck-a" truckName="BMW AJ123" />)
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
}
it('cancellation leaves records and navigation untouched', async () => {
  vi.mocked(window.confirm).mockReturnValue(false)
  await clickDelete()
  expect(mocks.fetch).not.toHaveBeenCalled()
  expect(mocks.push).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeEnabled()
})
it('warns about irreversible truck history and preserves employee accounting', async () => {
  mocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }))
  await clickDelete()
  const warning = vi.mocked(window.confirm).mock.calls[0][0]!
  for (const term of ['BMW AJ123', 'transacciones', 'kilometrajes', 'historial operativo', 'nóminas', 'días de pago', 'otros camiones', 'no se puede deshacer']) expect(warning).toContain(term)
})
it('sends explicit confirmation and preserves successful navigation', async () => {
  mocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }))
  await clickDelete()
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/trucks/truck-a', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmHistoryDeletion: true }),
  })
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/trucks'))
  expect(mocks.refresh).toHaveBeenCalledOnce()
})
it('disables deletion while pending and recovers after a safe server conflict', async () => {
  let resolve!: (response: Response) => void
  mocks.fetch.mockReturnValue(new Promise<Response>(done => { resolve = done }))
  await clickDelete()
  expect(screen.getByRole('button', { name: 'Eliminando...' })).toBeDisabled()
  resolve(new Response(JSON.stringify({ error: 'El camión cambió o tiene vínculos activos. Vuelve a intentarlo.' }), { status: 409, headers: { 'Content-Type': 'application/json' } }))
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith('El camión cambió o tiene vínculos activos. Vuelve a intentarlo.'))
  expect(mocks.push).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeEnabled()
})
it('does not expose or mislabel an HTML server failure as a connection failure', async () => {
  mocks.fetch.mockResolvedValue(new Response('<!DOCTYPE html><p>private detail</p>', { status: 500, headers: { 'Content-Type': 'text/html' } }))
  await clickDelete()
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Error al eliminar camión'))
  expect(mocks.push).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeEnabled()
})
it('handles network failure without navigation and restores the button', async () => {
  mocks.fetch.mockRejectedValue(new TypeError('network'))
  await clickDelete()
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Error de conexión'))
  expect(mocks.push).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeEnabled()
})
