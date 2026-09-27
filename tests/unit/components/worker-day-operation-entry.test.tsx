import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WorkerDayOperationEntry } from '@/components/trucks/worker-day-operation-entry'

const workers = [{ id: 'worker-a', name: 'Ana' }, { id: 'worker-b', name: 'Bea' }]
const trucks = [{ id: 'truck-a', name: 'ABC' }, { id: 'truck-b', name: 'DEF' }]
const renderEntry = () => render(<WorkerDayOperationEntry truckId="truck-a" workers={workers} trucks={trucks} />)
const selectDay = () => {
  fireEvent.change(screen.getByLabelText('Trabajador'), { target: { value: 'worker-a' } })
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-05-10' } })
}
const save = () => fireEvent.click(screen.getByRole('button', { name: /guardar jornada/i }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('creates a new single-truck day with one successful PUT and no premature success', async () => {
  let complete!: (value: unknown) => void
  const fetcher = vi.fn().mockResolvedValueOnce({ status: 404 }).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  vi.stubGlobal('fetch', fetcher)
  renderEntry()
  selectDay()
  await waitFor(() => expect((screen.getByLabelText('Empresa') as HTMLInputElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'Acme' } })
  const button = screen.getByRole('button', { name: /guardar jornada/i })
  save()
  fireEvent.click(button)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(screen.queryByText(/guardada correctamente/i)).toBeNull()
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ companyName: 'Acme', segments: [{ truckId: 'truck-a', share: 100 }] })
  complete({ ok: true })
  await waitFor(() => expect(screen.getByText(/guardada correctamente/i)).toBeTruthy())
})

it('requires a breakdown incident and submits edited shares with both truck IDs', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ status: 404 }).mockResolvedValueOnce({ ok: true })
  vi.stubGlobal('fetch', fetcher)
  renderEntry()
  selectDay()
  await waitFor(() => expect(screen.getByRole('button', { name: /añadir sustitución/i })).toBeTruthy())
  fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'Acme' } })
  fireEvent.click(screen.getByRole('button', { name: /añadir sustitución/i }))
  expect((screen.getByLabelText('Porcentaje principal') as HTMLInputElement).value).toBe('50')
  expect((screen.getByLabelText('Porcentaje sustituto') as HTMLInputElement).value).toBe('50')
  fireEvent.change(screen.getByLabelText('Camión de sustitución'), { target: { value: 'truck-b' } })
  expect((screen.getByRole('button', { name: /guardar jornada/i }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Incidencia del camión averiado'), { target: { value: 'Motor' } })
  fireEvent.change(screen.getByLabelText('Porcentaje principal'), { target: { value: '60' } })
  fireEvent.change(screen.getByLabelText('Porcentaje sustituto'), { target: { value: '40' } })
  save()
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(JSON.parse(fetcher.mock.calls[1][1].body).segments).toEqual([
    { truckId: 'truck-a', share: 60, incident: 'Motor' },
    { truckId: 'truck-b', share: 40 },
  ])
})

it('reports a 409 conflict without claiming success or retrying an unverified overwrite', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ status: 404 }).mockResolvedValueOnce({ ok: false, status: 409 })
  vi.stubGlobal('fetch', fetcher)
  renderEntry()
  selectDay()
  await waitFor(() => expect(screen.getByRole('button', { name: /guardar jornada/i })).toBeTruthy())
  fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'Acme' } })
  save()
  await waitFor(() => expect(screen.getByText(/conflicto/i)).toBeTruthy())
  expect(screen.queryByText(/guardada correctamente/i)).toBeNull()
  expect((screen.getByRole('button', { name: /guardar jornada/i }) as HTMLButtonElement).disabled).toBe(true)
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('ignores an old GET after changing worker and date', async () => {
  let finishOld!: (value: unknown) => void
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    .mockResolvedValueOnce({ status: 404 })
    .mockResolvedValueOnce({ status: 404 })
  vi.stubGlobal('fetch', fetcher)
  renderEntry()
  selectDay()
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Trabajador'), { target: { value: 'worker-b' } })
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-05-11' } })
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
  finishOld({ ok: true, json: async () => ({ operation: { companyName: 'Old', segments: [{ truckId: 'truck-a', share: 100 }] } }) })
  await waitFor(() => expect((screen.getByLabelText('Empresa') as HTMLInputElement).disabled).toBe(false))
  expect((screen.getByLabelText('Empresa') as HTMLInputElement).value).toBe('')
  expect(screen.queryByText(/existente cargada/i)).toBeNull()
})

it('does not invent legacy details but allows deliberate attachment of known details', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ operation: null }) }).mockResolvedValueOnce({ ok: true })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  vi.stubGlobal('fetch', fetcher)
  renderEntry()
  selectDay()
  await waitFor(() => expect(screen.getByText(/registro anterior sin empresa ni camión/i)).toBeTruthy())
  expect((screen.getByLabelText('Empresa') as HTMLInputElement).value).toBe('')
  fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'Real company' } })
  save()
  expect(fetcher).toHaveBeenCalledTimes(1)
  save()
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(JSON.parse(fetcher.mock.calls[1][1].body).segments[0].truckId).toBe('truck-a')
})

it('directs editing an operation with another primary truck to its primary view', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ operation: { companyName: 'Acme', segments: [{ truckId: 'truck-b', share: 100, kilometers: null, incident: null }] } }) })
  vi.stubGlobal('fetch', fetcher)
  renderEntry()
  selectDay()
  await waitFor(() => expect(screen.getByText(/camión principal.*DEF.*editar/i)).toBeTruthy())
  expect((screen.getByRole('button', { name: /guardar jornada/i }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('Camión principal: ABC')).toBeNull()
  expect(fetcher).toHaveBeenCalledTimes(1)
})
