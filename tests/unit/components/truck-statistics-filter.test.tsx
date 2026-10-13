import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TruckStatisticsFilter } from '@/components/trucks/truck-statistics-filter'
import type { TruckStatisticsPeriod } from '@/lib/truck-statistics-period'

const period: TruckStatisticsPeriod = { mode: 'current', month: '2026-03', from: '', to: '', label: 'Mes actual' }
function form() { return screen.getByRole('form', { name: 'Filtrar estadísticas' }) as HTMLFormElement }
function data() { return new FormData(form()) }
function select(mode: string) { fireEvent.change(screen.getByLabelText('Período de estadísticas'), { target: { value: mode } }) }

describe('truck statistics native filter', () => {
  it('defaults to current month and preserves unrelated and repeated fields without duplicate statistics keys', () => {
    render(<TruckStatisticsFilter period={period} preservedParams={{ month: '2025-12', type: 'EXPENSE', sort: 'asc', transactionsCursor: 'next:t1', segmentsCursor: 'prev:s1', tag: ['one', 'two'], absent: undefined, statsPeriod: ['all', 'range'], statsMonth: '2020-01', statsFrom: '2020-01-01', statsTo: '2020-02-01' }} />)
    expect(form()).toHaveAttribute('method', 'get')
    expect(form()).not.toHaveAttribute('action')
    expect(screen.getByRole('button', { name: 'Aplicar' })).toHaveAttribute('type', 'submit')
    expect(screen.getByLabelText('Período de estadísticas')).toHaveValue('current')
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Mes actual', 'Mes elegido', 'Total histórico', 'Desde-Hasta'])
    expect(data().getAll('statsPeriod')).toEqual(['current'])
    for (const key of ['statsMonth', 'statsFrom', 'statsTo', 'absent']) expect(data().has(key)).toBe(false)
    for (const [key, value] of Object.entries({ month: '2025-12', type: 'EXPENSE', sort: 'asc', transactionsCursor: 'next:t1', segmentsCursor: 'prev:s1' })) expect(data().get(key)).toBe(value)
    expect(data().getAll('tag')).toEqual(['one', 'two'])
    expect(screen.queryByText('Solo estadísticas. Desde y Hasta son inclusive (Europe/Madrid); los movimientos y el informe mensual mantienen sus filtros.')).not.toBeInTheDocument()
  })
  it('selects a required bounded month, then submits only all-history mode when switched', () => {
    render(<TruckStatisticsFilter period={period} />)
    select('month')
    const month = screen.getByLabelText('Mes de estadísticas')
    expect(month).toHaveAttribute('type', 'month')
    expect(month).toBeRequired()
    expect(month).toHaveAttribute('min', '1900-01')
    expect(month).toHaveAttribute('max', '2199-12')
    expect(month).toHaveValue('2026-03')
    fireEvent.change(month, { target: { value: '2026-02' } })
    expect(data().getAll('statsMonth')).toEqual(['2026-02'])
    select('all')
    expect(Array.from(data().entries())).toEqual([['statsPeriod', 'all']])
    expect(form().checkValidity()).toBe(true)
  })
  it('requires both inclusive dates, allows equal endpoints, and rejects backwards ranges natively', () => {
    render(<TruckStatisticsFilter period={period} />)
    select('range')
    const from = screen.getByLabelText('Desde')
    const to = screen.getByLabelText('Hasta')
    for (const field of [from, to]) { expect(field).toBeRequired(); expect(field).toHaveAttribute('type', 'date') }
    expect(from).toHaveAttribute('min', '1900-01-01')
    expect(from).toHaveAttribute('max', '2199-12-31')
    expect(to).toHaveAttribute('min', '1900-01-01')
    expect(to).toHaveAttribute('max', '2199-12-31')
    expect(form().checkValidity()).toBe(false)
    fireEvent.change(from, { target: { value: '2026-03-10' } })
    fireEvent.change(to, { target: { value: '2026-03-10' } })
    expect(form().checkValidity()).toBe(true)
    expect(Array.from(data().entries())).toEqual([['statsPeriod', 'range'], ['statsFrom', '2026-03-10'], ['statsTo', '2026-03-10']])
    fireEvent.change(to, { target: { value: '2026-03-09' } })
    expect(form().checkValidity()).toBe(false)
    expect(to).toHaveAttribute('min', '2026-03-10')
    expect(from).toHaveAttribute('max', '2026-03-09')
    select('current')
    expect(Array.from(data().entries())).toEqual([['statsPeriod', 'current']])
    expect(form().checkValidity()).toBe(true)
  })
  it('initializes selected range defaults and safely preserves text values', () => {
    render(<TruckStatisticsFilter period={{ ...period, mode: 'range', from: '1900-01-01', to: '2199-12-31' }} preservedParams={{ note: '<script>&"' }} />)
    expect(screen.getByLabelText('Período de estadísticas')).toHaveValue('range')
    expect(data().get('statsFrom')).toBe('1900-01-01')
    expect(data().get('statsTo')).toBe('2199-12-31')
    expect(data().get('note')).toBe('<script>&"')
    expect(form().querySelector('script')).toBeNull()
    expect(form().checkValidity()).toBe(true)
  })
})
