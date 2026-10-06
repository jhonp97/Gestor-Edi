import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { TruckMonthlyReport } from '@/components/trucks/truck-monthly-report'

const page = { previous: null, next: null, current: undefined, hasMore: false, count: 0 }
const pages = { transactions: page, segments: page }
const empty = { pages, month: '2026-03', totals: { income: '0.00', expense: '0.00' }, transactions: [], segments: [] }

describe('truck monthly report', () => {
  it('provides accessible native pagination links preserving independent state and GET filters', () => {
    const html = renderToStaticMarkup(<TruckMonthlyReport report={{ ...empty, pages: { transactions: { previous: 'prev:t50', next: 'next:t01', current: 'next:t51', count: 50, hasMore: true }, segments: { ...page, current: 'prev:s01' } } }} type="EXPENSE" sort="asc" />)
    expect(html).toContain('aria-label="Paginación de transacciones"')
    expect(html).toContain('aria-label="Anterior: transacciones"')
    expect(html).toContain('aria-label="Siguiente: transacciones"')
    expect(html).toContain('month=2026-03&amp;type=EXPENSE&amp;sort=asc&amp;transactionsCursor=next%3At01&amp;segmentsCursor=prev%3As01')
    expect(html).toContain('Continuación · 50 filas en esta página · Hay más resultados')
    const final = renderToStaticMarkup(<TruckMonthlyReport report={empty} type="" sort="desc" />)
    expect(final).toContain('Inicio · 0 filas en esta página · Fin de resultados')
    expect(final).not.toContain('aria-label="Siguiente:')
    expect(final).not.toContain('aria-label="Anterior:')
  })
  it('renders a recorded transaction and one attributed split-day segment without wages', () => {
    const html = renderToStaticMarkup(<TruckMonthlyReport report={{
      pages, month: '2026-03', totals: { income: '1.01', expense: '0.00' },
      transactions: [{ id: 'tx-1', truckId: 'truck-a', date: new Date('2026-03-31T21:00:00Z'), type: 'INCOME', amount: 1.005, description: 'Recorded freight', category: null }],
      segments: [{ id: 'segment-1', truckId: 'truck-a', workDate: new Date('2026-03-12T00:00:00Z'), share: 50, kilometers: new Prisma.Decimal('42.50'), incident: 'Breakdown', operation: { companyName: 'Example Co', dailyPayDay: { id: 'day', worker: { name: 'Worker A' } } } }],
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
