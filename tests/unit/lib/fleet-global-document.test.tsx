// @vitest-environment node
import { expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { inflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { FleetGlobalDocument } from '@/lib/pdf/fleet-global-document'
import type { FleetGlobalReport } from '@/lib/fleet-global-report-types'
const report: FleetGlobalReport = { month: '2026-03', period: 'month', periodLabel: 'Marzo 2026', trucks: [{ id: 'a', plate: 'AAA', operationalDays: 2, equivalentDays: '1.50', kilometers: '563.25', fuelExpense: '100.00' }], workers: [{ id: 'w', name: 'Ana', days: 2, equivalentDays: '1.50' }], mileageDays: [{ truckId: 'a', plate: 'AAA', date: '2026-03-02', kilometers: 248.25, companyName: 'PALIBEX' }, { truckId: 'a', plate: 'AAA', date: '2026-03-03', kilometers: 315, companyName: null }], mileageCompanies: [{ companyName: 'PALIBEX', truckDays: 1 }, { companyName: null, truckDays: 1 }], companies: [{ name: 'Empresa', truckDays: 2, workerDays: 2, equivalentDays: '1.50' }], totals: { truckDays: 2, calendarDays: 2, workerDays: 2, equivalentDays: '1.50', fuelExpense: '100.00' } }
function pages(buffer: Buffer) { return (buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length }
function contentStreams(buffer: Buffer) {
  const raw = buffer.toString('latin1')
  return [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => { try { return inflateSync(Buffer.from(match[1], 'latin1')).toString() } catch { return '' } })
}
function streamTextOperations(stream: string) {
  return [...stream.matchAll(/\[([^\]]*)\] TJ/g)].map(match => [...match[1].matchAll(/<([0-9a-f]+)>/g)].map(hex => Buffer.from(hex[1], 'hex').toString('latin1')).join(''))
}
function textOperations(buffer: Buffer) {
  return contentStreams(buffer).flatMap(streamTextOperations)
}
async function proof(buffer: Buffer, name: 'small' | 'large') {
  if (!process.env.FLEET_PDF_PROOF_DIR) return
  // Only this explicitly authorized project-local artifact directory may be written.
  expect(process.env.FLEET_PDF_PROOF_DIR).toBe('.next/global-fleet-pdf-proof')
  const directory = resolve('.next/global-fleet-pdf-proof')
  await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, `${name}.pdf`), buffer)
}
it('renders a real landscape A4 PDF with mileage details and company totals on the second page', async () => {
  const doc = FleetGlobalDocument({ report })
  const firstPage = Array.isArray(doc.props.children) ? doc.props.children[0] : doc.props.children
  expect(firstPage.props.size).toBe('A4')
  expect(firstPage.props.orientation).toBe('landscape')
  // Keep body text below the fixed header and its teal divider.
  expect(firstPage.props.style.paddingTop).toBeGreaterThanOrEqual(80)
  const buffer = await renderToBuffer(doc)
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  expect(buffer.length).toBeGreaterThan(1000)
  expect(buffer.toString('latin1')).toContain('%%EOF')
  expect(pages(buffer)).toBe(2)
  const content = textOperations(buffer).join('\n')
  expect(content).toMatch(/04 \/\s*Jornadas por camión con más de 200 km/)
  expect(content).toContain('Kilómetros')
  expect(content).toContain('563,25')
  expect(content).toContain('02/03/2026')
  expect(content).toContain('03/03/2026')
  expect(content).toContain('248,25')
  expect(content).toContain('315')
  expect(content).toContain('PALIBEX')
  expect(content).toContain('Sin empresa asociada')
  expect(content).toContain('Totales por empresa')
  await proof(buffer, 'small')
  process.stdout.write(`Small global PDF actual pages: ${pages(buffer)}\n`)
})
it('overflows naturally and renders every large-fixture row', async () => {
  const trucks = Array.from({ length: 100 }, (_, i) => ({ ...report.trucks[0], id: String(i), plate: `TRUCK${String(i).padStart(3, '0')}`, operationalDays: 700000 + i }))
  const workers = Array.from({ length: 100 }, (_, i) => ({ ...report.workers[0], id: String(i), name: `WORKERONLY${String(i).padStart(3, '0')}`, days: 800000 + i }))
  const companies = Array.from({ length: 100 }, (_, i) => ({ ...report.companies[0], name: `COMPANYONLY${String(i).padStart(3, '0')}`, truckDays: 900000 + i }))
  const buffer = await renderToBuffer(<FleetGlobalDocument report={{ ...report, trucks, workers, companies }} />)
  expect(pages(buffer)).toBeGreaterThan(1)
  const operations = textOperations(buffer)
  // Match complete text-show operations, not preamble substrings: these numeric
  // sentinels exist ONLY in table cells, never in the selected-plates heading.
  const exactlyOnce = (token: string) => expect(operations.filter(text => text === token).length, `table-only token ${token}`).toBe(1)
  for (const truck of trucks) exactlyOnce(String(truck.operationalDays))
  for (const worker of workers) { exactlyOnce(worker.name); exactlyOnce(String(worker.days)) }
  for (const company of companies) { exactlyOnce(company.name); exactlyOnce(String(company.truckDays)) }
  await proof(buffer, 'large')
  process.stdout.write(`Large global PDF actual pages: ${pages(buffer)}; verified table rows: trucks=100 workers=100 companies=100; exact table-only token assertions=500\n`)
}, 30000)

it('keeps explanatory notes with mileage instead of creating a nearly empty intermediate page', async () => {
  const trucks = Array.from({ length: 3 }, (_, i) => ({ ...report.trucks[0], id: String(i), plate: `TRUCK${i}` }))
  const workers = Array.from({ length: 6 }, (_, i) => ({ ...report.workers[0], id: String(i), name: `WORKER${i}` }))
  const companies = Array.from({ length: 3 }, (_, i) => ({ ...report.companies[0], name: `COMPANY${i}` }))
  const buffer = await renderToBuffer(<FleetGlobalDocument report={{ ...report, trucks, workers, companies }} />)
  // The first three tables may legitimately span pages. Notes must share a
  // content stream with mileage, rather than forming a notes-only page.
  const notePages = contentStreams(buffer).map(stream => streamTextOperations(stream).join('\n')).filter(text => text.includes('Día operativo:'))
  expect(notePages).toHaveLength(1)
  expect(notePages[0]).toMatch(/04 \/\s*Jornadas por camión con más de 200 km/)
  expect(notePages[0]).toContain('Totales por empresa')
  expect(notePages[0].indexOf('Día operativo:')).toBeGreaterThan(notePages[0].indexOf('Totales por empresa'))
})

it('places total kilometers between equivalent days and fuel in the truck table', () => {
  const doc = FleetGlobalDocument({ report: { ...report, trucks: [{ ...report.trucks[0], kilometers: '12345.67' }] } })
  const firstPage = doc.props.children[0]
  const table = firstPage.props.children.find((child: { props?: { title?: string } } | null | false) => child && child.props?.title === '01 / Camiones')
  expect(table.props.headers).toEqual(['Matrícula', 'Días operativos', 'Días equivalentes', 'Kilómetros', 'Combustible (€)'])
  expect(table.props.rows).toEqual([['AAA', '2', '1.50', '12.345,67', '100,00 €']])
})
