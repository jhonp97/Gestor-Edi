import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TruckCard } from '@/components/trucks/truck-card'
import type { Truck } from '@/types'

const truck = { id: 'truck-1', brand: 'Volvo', model: 'FH', plate: 'ABC', year: 2020, status: 'ACTIVE' } as Truck

describe('truck card statistics', () => {
  it('carries the selected statistics period and displays its label', () => {
    render(<TruckCard truck={truck} stats={{ income: 1200, expense: 200 }} statisticsQuery={{ statsPeriod: 'month', statsMonth: '2026-03' }} statisticsLabel="Marzo de 2026" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/trucks/truck-1?statsPeriod=month&statsMonth=2026-03')
    expect(screen.getByText('Marzo de 2026')).toBeInTheDocument()
    for (const text of ['Ingresos', 'Gastos', 'Balance', '$1.200,00', '$200,00', '$1.000,00']) expect(screen.getByText(text)).toBeInTheDocument()
  })
  it('keeps the original link and zero defaults without optional props', () => {
    render(<TruckCard truck={truck} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/trucks/truck-1')
    expect(screen.getAllByText('$0,00')).toHaveLength(3)
  })
  it('does not append a question mark for an empty query', () => {
    render(<TruckCard truck={truck} statisticsQuery={{}} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/trucks/truck-1')
  })
})
