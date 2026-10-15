// @vitest-environment node
import { expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { inflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { FleetGlobalDocument } from '@/lib/pdf/fleet-global-document'
import type { FleetGlobalReport } from '@/lib/fleet-global-report-types'
const report: FleetGlobalReport = { month: '2026-03', period: 'month', periodLabel: 'Marzo 2026', trucks: [{ id: 'a', plate: 'AAA', operationalDays: 2, equivalentDays: '1.50', fuelExpense: '100.00' }], workers: [{ id: 'w', name: 'Ana', days: 2, equivalentDays: '1.50' }], companies: [{ name: 'Empresa', truckDays: 2, workerDays: 2, equivalentDays: '1.50' }], totals: { truckDays: 2, calendarDays: 2, workerDays: 2, equivalentDays: '1.50', fuelExpense: '100.00' } }
function pages(buffer: Buffer) { return (buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length }
function streams(buffer: Buffer) {
  const raw = buffer.toString('latin1')
  return [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => { try { return inflateSync(Buffer.from(match[1], 'latin1')).toString() } catch { return '' } }).join('\n')
}
function textOperations(buffer: Buffer) {
  return [...streams(buffer).matchAll(/\[([^\]]*)\] TJ/g)].map(match => [...match[1].matchAll(/<([0-9a-f]+)>/g)].map(hex => Buffer.from(hex[1], 'hex').toString('latin1')).join(''))
}
async function proof(buffer: Buffer, name: 'small' | 'large') {
  if (!process.env.FLEET_PDF_PROOF_DIR) return
  // Only this explicitly authorized project-local artifact directory may be written.
  expect(process.env.FLEET_PDF_PROOF_DIR).toBe('.next/global-fleet-pdf-proof')
  const directory = resolve('.next/global-fleet-pdf-proof')
  await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, `${name}.pdf`), buffer)
}
it('renders a real compact landscape A4 PDF on one page', async () => {
  const doc = FleetGlobalDocument({ report })
  expect(doc.props.children.props.size).toBe('A4')
  expect(doc.props.children.props.orientation).toBe('landscape')
  // Keep body text below the fixed header and its teal divider.
  expect(doc.props.children.props.style.paddingTop).toBeGreaterThanOrEqual(80)
  const buffer = await renderToBuffer(doc)
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  expect(buffer.length).toBeGreaterThan(1000)
  expect(buffer.toString('latin1')).toContain('%%EOF')
  expect(pages(buffer)).toBe(1)
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
