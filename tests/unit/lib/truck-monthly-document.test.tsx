// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { Page, renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { TruckMonthlyDocument } from '@/lib/pdf/truck-monthly-document'
import type { TruckMonthlyExport } from '@/lib/truck-monthly-export'
vi.mock('server-only', () => ({}))
function collectPages(node: React.ReactNode): React.ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(collectPages)
  if (!React.isValidElement(node)) return []
  const children = (node.props as { children?: React.ReactNode }).children
  return [...(node.type === Page ? [node] : []), ...collectPages(children)]
}
function treeText(node: React.ReactNode): string {
  if (Array.isArray(node)) return node.map(treeText).join(' ')
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!React.isValidElement(node)) return ''
  return treeText((node.props as { children?: React.ReactNode }).children)
}
function fixedText(node: React.ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(fixedText)
  if (!React.isValidElement(node)) return []
  const props = node.props as { children?: React.ReactNode; fixed?: boolean }
  return [...(props.fixed ? [treeText(props.children)] : []), ...fixedText(props.children)]
}

const report: TruckMonthlyExport = {
  month: '2026-03',
  trucks: [{ id: 'a', plate: 'SYNTHETIC',
    days: Array.from({ length: 31 }, (_, index) => ({ date: `2026-03-${String(index + 1).padStart(2, '0')}`, km: index === 0 ? null : '0', income: null, expense: '0.00', workers: Array.from({ length: 8 }, (_, i) => ({ id: `w${i}`, name: `Synthetic Worker ${i} with a long wrapping name`, company: 'Synthetic Company with a long wrapping descriptive label', share: 50 })) })),
    workers: [{ id: 'w0', name: 'Synthetic Worker', dates: 31, equivalentDays: '15.5' }],
    totals: { km: '0', income: '0.00', expense: '0.00', net: '0.00' },
  }],
}
it('keeps every date and assignment in a flowing document with repeated labels and page numbers', () => {
  const tree = TruckMonthlyDocument({ report })
  const text = JSON.stringify(tree)
  for (const day of report.trucks[0].days) expect(text).toContain(day.date)
  expect(text).toContain('Sin registro')
  for (const label of ['Resumen del mes', 'Kilómetros recorridos', 'Gastos del mes', 'Ingresos del mes', 'Balance del mes', 'Ingresos menos gastos', 'Días trabajados por trabajador', 'Trabajador', 'Días trabajados', 'Días equivalentes']) expect(text).toContain(label)
  for (const copy of ['Importes y kilómetros registrados;', 'Sin registro no equivale a cero', 'Transacciones: Europe/Madrid', 'Resultado registrado']) expect(text).not.toContain(copy)
  expect(text).toContain('"fontSize":20')
  expect(text).toContain('"fontSize":16')
  expect(text).toContain('"fontSize":11')
  expect(text).not.toContain('DNI')
  expect(text).toContain('landscape')
  expect(text).toContain('"fixed":true')
  expect(text).toContain('"wrap":false')
})
it('allocates separate per-truck worker-summary pages', () => {
  const secondTruck = { ...report.trucks[0], id: 'b', plate: 'SYNTHETIC-B' }
  const pages = collectPages(TruckMonthlyDocument({ report: { ...report, trucks: [report.trucks[0], secondTruck] } }))
  expect(pages).toHaveLength(6)
  const workerPages = pages.filter(page => treeText(page).includes('Días trabajados por trabajador'))
  expect(workerPages).toHaveLength(2)
  for (const page of workerPages) {
    const repeatedHeader = fixedText(page).join(' ')
    for (const label of ['Días trabajados por trabajador', 'Trabajador', 'Días trabajados', 'Días equivalentes']) expect(repeatedHeader).toContain(label)
  }
})
it('preserves precise amounts, balance signs, missing records and every long worker name across trucks', () => {
  const cases = [
    { km: null, income: '123456.7890', expense: '23.4500', net: '123433.3390', status: 'Saldo positivo' },
    { km: '0', income: '0.00', expense: '12.3400', net: '-12.3400', status: 'Saldo negativo' },
    { km: '123.456789', income: '0.00', expense: '0.00', net: '-0.0000', status: 'Sin diferencia' },
    { km: null, income: '0.00', expense: '0.00', net: '0.00', status: 'Sin diferencia' },
  ]
  const trucks = cases.map((totals, index) => ({ ...report.trucks[0], id: `truck-${index}`, plate: `PLATE-${index}`, days: [], totals,
    workers: Array.from({ length: 70 }, (_, i) => ({ id: `worker-${i}`, name: `Worker ${i} with a very long synthetic wrapping family name`, dates: i, equivalentDays: `${i}.5000` })),
  }))
  const text = JSON.stringify(TruckMonthlyDocument({ report: { ...report, trucks } }))
  for (const truck of trucks) {
    expect(text).toContain(truck.plate)
    const isolatedText = JSON.stringify(TruckMonthlyDocument({ report: { ...report, trucks: [truck] } }))
    expect(isolatedText).toContain(truck.totals.status)
    for (const status of ['Saldo positivo', 'Saldo negativo', 'Sin diferencia']) {
      if (status !== truck.totals.status) expect(isolatedText).not.toContain(status)
    }
    if (truck.totals.km === null) expect(isolatedText).toContain('Sin registro')
    for (const value of [truck.totals.km, truck.totals.income, truck.totals.expense, truck.totals.net]) if (value !== null) expect(text).toContain(value)
    for (const worker of truck.workers) {
      expect(text).toContain(worker.name)
      expect(text).toContain(worker.equivalentDays)
    }
  }
  expect(JSON.stringify(TruckMonthlyDocument({ report: { ...report, trucks: [] } }))).toContain('no hay camiones registrados')
  expect(JSON.stringify(TruckMonthlyDocument({ report: { ...report, trucks: [{ ...trucks[0], workers: [] }] } }))).toContain('Sin jornadas registradas')
})
it('actually renders a multi-truck worker summary flowing over multiple pages', async () => {
  const truck = { ...report.trucks[0], days: [], workers: Array.from({ length: 90 }, (_, i) => ({ id: `w${i}`, name: `Synthetic Worker ${i} with a long wrapping name and additional family names`, dates: 31, equivalentDays: '15.5000' })) }
  const buffer = await renderToBuffer(<TruckMonthlyDocument report={{ ...report, trucks: [truck, { ...truck, id: 'b', plate: 'SECOND' }] }} />)
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  expect((buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(4)
}, 120000)
it('actually renders a nonempty multi-page synthetic PDF with built-in fonts only', async () => {
  const buffer = await renderToBuffer(<TruckMonthlyDocument report={report} />)
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  expect(buffer.length).toBeGreaterThan(3000)
  const source = buffer.toString('latin1')
  expect((source.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1)
}, 120000)
