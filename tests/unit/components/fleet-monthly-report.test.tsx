import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FleetMonthlyReport } from '@/components/trucks/fleet-monthly-report'

afterEach(cleanup)

it('explains independent rounding and shows an empty fleet explicitly', () => {
  render(<FleetMonthlyReport report={{ month: '2026-03', selectedTruck: 'all', trucks: [], byTruck: [], totals: { income: '0.00', expense: '0.00' }, workerDays: 0, transactions: [], segments: [] }} />)
  expect(screen.getByText(/No hay camiones registrados/)).toBeTruthy()
  expect(screen.getByText(/redondean de forma independiente/)).toBeTruthy()
})

it('renders the company only on its operational row and keeps the selected GET filters', () => {
  render(<FleetMonthlyReport report={{ month: '2026-03', selectedTruck: 'truck-a', trucks: [{ id: 'truck-a', plate: 'AAA' }], byTruck: [{ id: 'truck-a', plate: 'AAA', totals: { income: '0.30', expense: '0.00' } }], totals: { income: '0.30', expense: '0.00' }, workerDays: 1, transactions: [], segments: [{ id: 's', truckId: 'truck-a', workDate: new Date('2026-03-01'), share: 100, kilometers: null, incident: null, operation: { companyName: 'Exact Co', dailyPayDay: { id: 'day', worker: { name: 'Ana' } } } }] }} />)
  expect((screen.getByLabelText('Mes') as HTMLInputElement).value).toBe('2026-03')
  expect((screen.getByLabelText('Camión') as HTMLSelectElement).value).toBe('truck-a')
  expect(screen.getByText(/Exact Co/).closest('li')).toBeTruthy()
  expect(screen.getAllByText(/Exact Co/)).toHaveLength(1)
  expect(screen.queryByText(/subtotal de empresa/i)).toBeNull()
})
