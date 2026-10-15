import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FleetGlobalReportForm } from '@/components/trucks/fleet-global-report-form'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('selects trucks independently, clears and generates repeated truck query parameters', () => {
  render(<FleetGlobalReportForm trucks={[{ id: 'a', plate: 'AAA' }, { id: 'b', plate: 'BBB' }]} month="2026-03" period="month" />)
  const button = screen.getByRole('button', { name: 'Descargar resumen global' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.click(screen.getByLabelText('AAA'))
  expect(screen.getByText('1 camiones seleccionados')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todos' }))
  fireEvent.change(screen.getByLabelText('Período del resumen'), { target: { value: 'quarter' } })
  fireEvent.change(screen.getByLabelText('Mes del resumen'), { target: { value: '2026-06' } })
  const form = button.closest('form')!
  const query = new URLSearchParams(new FormData(form) as never)
  expect(query.getAll('truck')).toEqual(['a', 'b'])
  expect(query.get('month')).toBe('2026-06')
  expect(query.get('period')).toBe('quarter')
  expect(form.getAttribute('action')).toBe('/api/trucks/report/global/pdf')
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar selección' }))
  expect(button.disabled).toBe(true)
})
it('announces loading and recoverable download failures', async () => {
  let finish!: (value: { ok: boolean }) => void
  const fetchMock = vi.fn(() => new Promise(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetchMock)
  render(<FleetGlobalReportForm trucks={[{ id: 'a', plate: 'AAA' }, { id: 'b', plate: 'BBB' }]} month="2026-03" period="year" />)
  fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todos' }))
  const button = screen.getByRole('button', { name: 'Descargar resumen global' }) as HTMLButtonElement
  fireEvent.submit(button.closest('form')!)
  expect(button.disabled).toBe(true)
  expect(screen.getByRole('status').textContent).toContain('Preparando PDF')
  expect(fetchMock).toHaveBeenCalledWith('/api/trucks/report/global/pdf?month=2026-03&period=year&truck=a&truck=b')
  finish({ ok: false })
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('vuelve a intentarlo'))
  expect(button.disabled).toBe(false)
})
it('explains an empty available fleet', () => {
  render(<FleetGlobalReportForm trucks={[]} month="2026-03" period="year" />)
  expect(screen.getByText('No hay camiones disponibles.')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Descargar resumen global' }) as HTMLButtonElement).disabled).toBe(true)
})
