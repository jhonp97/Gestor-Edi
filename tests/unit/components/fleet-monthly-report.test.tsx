import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FleetMonthlyReport } from '@/components/trucks/fleet-monthly-report'

afterEach(cleanup)

it('explains independent rounding and shows an empty fleet explicitly', () => {
  render(<FleetMonthlyReport report={{ period: 'month', month: '2026-03', selectedTruck: 'all', trucks: [], byTruck: [], totals: { income: '0.00', expense: '0.00' }, workerDays: 0, transactions: [], segments: [] }} />)
  expect(screen.getByText(/No hay camiones registrados/)).toBeTruthy()
  expect(screen.getByText(/redondean de forma independiente/)).toBeTruthy()
})

it('renders the company only on its operational row and keeps the selected GET filters', () => {
  render(<FleetMonthlyReport report={{ period: 'month', month: '2026-03', selectedTruck: 'truck-a', trucks: [{ id: 'truck-a', plate: 'AAA' }], byTruck: [{ id: 'truck-a', plate: 'AAA', totals: { income: '0.30', expense: '0.00' } }], totals: { income: '0.30', expense: '0.00' }, workerDays: 1, transactions: [], segments: [{ id: 's', truckId: 'truck-a', workDate: new Date('2026-03-01'), share: 100, kilometers: null, incident: null, operation: { companyName: 'Exact Co', dailyPayDay: { id: 'day', worker: { name: 'Ana' } } } }] }} />)
  expect((screen.getByLabelText('Mes de referencia') as HTMLInputElement).value).toBe('2026-03')
  expect((screen.getByLabelText('Camión') as HTMLSelectElement).value).toBe('truck-a')
  expect((screen.getByLabelText('Período') as HTMLSelectElement).value).toBe('month')
  expect(screen.getByText(/Exact Co/).closest('li')).toBeTruthy()
  expect(screen.getAllByText(/Exact Co/)).toHaveLength(1)
  expect(screen.queryByText(/subtotal de empresa/i)).toBeNull()
})

it('shows only aggregates for annual selection while retaining GET filters', () => {
  render(<FleetMonthlyReport report={{ period: 'year', month: '2026-12', selectedTruck: 'truck-a', trucks: [{ id: 'truck-a', plate: 'AAA' }], byTruck: [], totals: { income: '1.00', expense: '0.00' }, workerDays: 2, transactions: [], segments: [] }} />)
  expect((screen.getByLabelText('Período') as HTMLSelectElement).value).toBe('year')
  expect((screen.getByLabelText('Mes de referencia') as HTMLInputElement).value).toBe('2026-12')
  expect((screen.getByLabelText('Camión') as HTMLSelectElement).value).toBe('truck-a')
  expect(screen.queryByRole('region', { name: 'Transacciones registradas' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Jornadas atribuidas' })).toBeNull()
  expect(screen.getByText('Año 2026')).toBeTruthy()
})

it.each([
  ['quarter', '2026-03', 'Trimestre 1 de 2026'],
  ['quarter', '2026-12', 'Trimestre 4 de 2026'],
  ['half-year', '2026-02', 'Semestre 1 de 2026'],
  ['half-year', '2026-08', 'Semestre 2 de 2026'],
] as const)('names selected %s period for %s', (period, month, label) => {
  render(<FleetMonthlyReport report={{ period, month, selectedTruck: 'all', trucks: [], byTruck: [], totals: { income: '0.00', expense: '0.00' }, workerDays: 0, transactions: [], segments: [] }} />)
  expect(screen.getByText(label)).toBeTruthy()
})
