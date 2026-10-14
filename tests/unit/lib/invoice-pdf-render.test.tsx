// @vitest-environment node
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoiceDocument } from '@/lib/pdf/invoice-document'
import { createInvoiceDraft } from '@/lib/invoice'

function decodedStreams(bytes: Buffer) {
  const source = bytes.toString('latin1')
  return [...source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => {
    try { return inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1') } catch { return match[1] }
  }).join('\n')
}
function visibleText(streams: string) {
  return [...streams.matchAll(/<([0-9a-f]+)>/gi)].map(match => Buffer.from(match[1], 'hex').toString('latin1')).join('').replace(/\s/g, '')
}

describe('real invoice PDF', () => {
  it('renders A4, branding, local logo and calculated reference amounts in memory', async () => {
    const invoice = { ...createInvoiceDraft(new Date('2026-09-01T12:00:00Z'), 13), lines: [25, 28, 5, 5].map((quantity, i) => ({ description: `Servicio ${i}`, quantity: String(quantity), unitPrice: i === 3 ? '30' : '185' })) }
    const bytes = await renderToBuffer(<InvoiceDocument invoice={invoice} />)
    const source = bytes.toString('latin1')
    expect(source.startsWith('%PDF-')).toBe(true)
    expect(source).toContain('/Subtype /Image')
    const dimensions = source.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)
    expect(dimensions).not.toBeNull()
    expect(Number(dimensions?.[1])).toBeCloseTo(595.28, 2)
    expect(Number(dimensions?.[2])).toBeCloseTo(841.89, 2)
    const text = visibleText(decodedStreams(bytes))
    expect(text).toContain('TransportesAcevedoHernandez')
    expect(text).toContain('12.506,56')
  }, 30000)
  it('wraps long unbroken concepts across multiple pages and repeats table headings', async () => {
    const invoice = { ...createInvoiceDraft(), lines: Array.from({ length: 100 }, (_, i) => ({ description: `Servicio ${i} ${'concepto'.repeat(60)}`, quantity: '1', unitPrice: '1' })) }
    const bytes = await renderToBuffer(<InvoiceDocument invoice={invoice} />)
    const source = bytes.toString('latin1')
    expect((source.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1)
    const text = visibleText(decodedStreams(bytes))
    expect(text.split('Concepto').length - 1).toBeGreaterThan(1)
    expect(text).toContain('114,95')
  }, 30000)
  it('rejects invalid data even when called directly', () => {
    expect(() => InvoiceDocument({ invoice: { ...createInvoiceDraft(), date: '2026-02-30' } })).toThrow()
  })
})
