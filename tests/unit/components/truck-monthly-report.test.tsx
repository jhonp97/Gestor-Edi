import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { TruckMonthlyReport } from '@/components/trucks/truck-monthly-report'

const empty = { month: '2026-03', totals: { income: '0.00', expense: '0.00' }, transactions: [], segments: [] }

describe('truck monthly report', () => {
  it('renders a recorded transaction and one attributed split-day segment without wages', () => {
    const html = renderToStaticMarkup(<TruckMonthlyReport report={{
      month: '2026-03', totals: { income: '1.01', expense: '0.00' },
      transactions: [{ id: 'tx-1', date: new Date('2026-03-31T21:00:00Z'), type: 'INCOME', amount: 1.005, description: 'Recorded freight', category: null }],
      segments: [{ id: 'segment-1', workDate: new Date('2026-03-12T00:00:00Z'), share: 50, kilometers: new Prisma.Decimal('42.50'), incident: 'Breakdown', operation: { companyName: 'Example Co', dailyPayDay: { worker: { name: 'Worker A' } } } }],
    }} type="EXPENSE" sort="asc" />)
    expect(html).toContain('name="type" value="EXPENSE"')
    expect(html).toContain('name="sort" value="asc"')
    expect(html).toContain('€1.005')
    expect(html).toContain('€1.01')
    expect(html).toContain('Example Co · Worker A · 50% · 42.5 km · Incidencia: Breakdown')
    expect(html).not.toContain('Salario')
  })
  it('shows empty states and Madrid time policy without inferred pay', () => {
    const html = renderToStaticMarkup(<TruckMonthlyReport report={empty} type="" sort="desc" />)
    expect(html).toContain('Europe/Madrid')
    expect(html).toContain('No hay transacciones registradas')
    expect(html).toContain('No hay jornadas atribuidas')
    expect(html).toContain('2026-03')
  })
})
