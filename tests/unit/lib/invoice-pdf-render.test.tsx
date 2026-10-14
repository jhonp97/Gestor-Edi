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
    expect((source.match(/\/Type \/Page\b/g) ?? []).length).toBe(1)
  }, 30000)
  it('uses larger text and logo while preserving invoice totals', async () => {
    const invoice = { ...createInvoiceDraft(), lines: [{ description: 'Servicio', quantity: '1', unitPrice: '100' }] }
    const bytes = await renderToBuffer(<InvoiceDocument invoice={invoice} />)
    const streams = decodedStreams(bytes)
    expect(/\/F\d+ 12 Tf/.test(streams)).toBe(true)
    // The supplied 622×553 asset fits proportionally within the 124×93 box.
    const matrices = [...streams.matchAll(/(-?[\d.]+) 0 0 (-?[\d.]+) -?[\d.]+ -?[\d.]+ cm/g)]
    expect(matrices.some(matrix => Math.abs(Number(matrix[1]) - 93 * 622 / 553) < 0.01 && Math.abs(Number(matrix[2]) + 93) < 0.01)).toBe(true)
    expect(bytes.toString('latin1')).toContain('/Subtype /Image')
    expect(visibleText(streams)).toContain('114,95')
  }, 30000)
  it('starts with FACTURA and logo and places the main rule below that complete block', () => {
    const page = InvoiceDocument({ invoice: createInvoiceDraft() }).props.children
    const header = page.props.children[0]
    expect(header.props.children).toHaveLength(3)
    const overview = header.props.children[0]
    expect(overview.props.style).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1.5, paddingBottom: 4 })
    const titleChildren = overview.props.children[0].props.children
    const title = Array.isArray(titleChildren) ? titleChildren[0] : titleChildren
    expect(overview.props.children[1].props.style).toMatchObject({ width: 124, height: 93, objectFit: 'contain', marginTop: -6 })
    expect(title.props.paint).toBeTypeOf('function')
    expect(title.props.style).toMatchObject({ fontSize: 30, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, color: '#111111' })
  })
  it('raises the logo independently without changing image dimensions', () => {
    const page = InvoiceDocument({ invoice: createInvoiceDraft() }).props.children
    const overview = page.props.children[0].props.children[0]
    expect(overview.props.children[1].props.style).toMatchObject({ width: 124, height: 93, marginTop: -6, transform: 'translateY(-14)' })
    expect(overview.props.style.alignItems).toBe('center')
  })
  it('lowers FACTURA slightly without changing its size or weight', () => {
    const page = InvoiceDocument({ invoice: createInvoiceDraft() }).props.children
    const title = page.props.children[0].props.children[0].props.children[0].props.children
    expect(title.props.style).toMatchObject({ transform: 'translateY(6)', fontSize: 30, height: 33, fontFamily: 'Helvetica-Bold' })
  })
  it('makes FACTURA genuinely heavier using fill plus a thin stroke, without enlarging or duplicating it', async () => {
    const invoice = { ...createInvoiceDraft(), lines: [{ description: 'Servicio', quantity: '1', unitPrice: '100' }] }
    const streams = decodedStreams(await renderToBuffer(<InvoiceDocument invoice={invoice} />))
    expect(/\b2 Tr\b/.test(streams)).toBe(true)
    expect(/\b0\.35 w\b/.test(streams)).toBe(true)
    expect(/\/F\d+ 30 Tf/.test(streams)).toBe(true)
    // FACTURAR A shares the prefix but is not a duplicate invoice title.
    expect((visibleText(streams).match(/FACTURA(?!R)/g) ?? []).length).toBe(1)
    expect(visibleText(streams)).toContain('114,95')
  }, 30000)
  it('puts dynamic invoice number and date below the ruled title-logo row', () => {
    for (const [number, date, expected] of [[14, '2026-10-31', 'Número: 14    Fecha: 31/10/2026'], [29, '2026-11-30', 'Número: 29    Fecha: 30/11/2026']] as const) {
      const invoice = { ...createInvoiceDraft(), number, date }
      const page = InvoiceDocument({ invoice }).props.children
      const header = page.props.children[0]
      const [overview, metadata] = header.props.children
      const titleChildren = overview.props.children[0].props.children
      expect(Array.isArray(titleChildren) ? titleChildren : [titleChildren]).toHaveLength(1)
      expect(metadata.props.children).toBe(expected)
      expect(metadata.props.style.marginTop).toBe(10)
      expect(overview.props.style.borderBottomWidth).toBe(1.5)
    }
  })
  it('adds readable spacing to every issuer and recipient data line', () => {
    const page = InvoiceDocument({ invoice: createInvoiceDraft() }).props.children
    const parties = page.props.children[0].props.children.at(-1)
    for (const party of parties.props.children) {
      const rendered = party.type(party.props)
      expect(rendered.props.children[0].props.style.marginBottom).toBe(7)
      for (const line of rendered.props.children[1]) {
        const style = Array.isArray(line.props.style) ? Object.assign({}, ...line.props.style) : line.props.style
        expect(style).toMatchObject({ fontSize: 11, lineHeight: 1.45, marginBottom: 3 })
      }
    }
  })
  it('makes only the table heading band slightly shorter', () => {
    const page = InvoiceDocument({ invoice: createInvoiceDraft() }).props.children
    expect(page.props.style.fontSize).toBe(12)
    expect(page.props.children[1].props.style).toMatchObject({ paddingVertical: 6, backgroundColor: '#252b33', fontFamily: 'Helvetica-Bold' })
    expect(page.props.children[1].props.fixed).toBe(true)
  })
  it('centers all column labels vertically without changing horizontal alignment or body cells', () => {
    const page = InvoiceDocument({ invoice: createInvoiceDraft() }).props.children
    const headings = page.props.children[1]
    expect(headings.props.style.alignItems).toBe('center')
    const expected = [undefined, 'right', 'right', 'right']
    for (const [index, cell] of headings.props.children.entries()) {
      const style = Array.isArray(cell.props.style) ? Object.assign({}, ...cell.props.style) : cell.props.style
      expect(style.lineHeight).toBe(1.3)
      expect(style.textAlign).toBe(expected[index])
    }
    const row = page.props.children[2][0]
    expect(row.props.children[1].props.style.lineHeight).toBeUndefined()
  })
  it('moves the company name to a centered gray fixed footer matching page-number typography', () => {
    const page = InvoiceDocument({ invoice: createInvoiceDraft() }).props.children
    const brand = page.props.children.at(-2)
    const pagination = page.props.children.at(-1)
    expect(brand.props.children).toBe('Transportes Acevedo Hernandez')
    expect(brand.props.fixed).toBe(true)
    expect(brand.props.style).toMatchObject({ position: 'absolute', bottom: pagination.props.style.bottom, left: 36, right: 36, textAlign: 'center', fontSize: pagination.props.style.fontSize, color: pagination.props.style.color, fontFamily: 'Helvetica' })
    expect(pagination.props.fixed).toBe(true)
    expect(pagination.props.render({ pageNumber: 1, totalPages: 3 })).toBe('Página 1 de 3')
  })
  it('separates each party label from its unchanged data with a light gray rule', () => {
    const page = InvoiceDocument({ invoice: createInvoiceDraft() }).props.children
    const parties = page.props.children[0].props.children.at(-1)
    for (const party of parties.props.children) {
      const rendered = party.type(party.props)
      expect(rendered.props.children[0].props.style).toMatchObject({ borderBottomWidth: 0.7, borderBottomColor: '#d7dce1', paddingBottom: 5, marginBottom: 7 })
      expect(rendered.props.children[0].props.children.props.children).toBe(party.props.title.toUpperCase())
      expect(rendered.props.children[1].map((line: { props: { children: string } }) => line.props.children)).toEqual([
        party.props.party.name, `NIF/CIF: ${party.props.party.taxId}`, party.props.party.address, `${party.props.party.postalCode} ${party.props.party.city}`,
      ])
    }
  })
  it('uppercases bold party labels and emphasizes only the unchanged names in dark blue', () => {
    const page = InvoiceDocument({ invoice: createInvoiceDraft() }).props.children
    const parties = page.props.children[0].props.children.at(-1)
    const labels = []
    for (const party of parties.props.children) {
      const rendered = party.type(party.props)
      const heading = rendered.props.children[0]
      const label = typeof heading.props.children === 'string' ? heading : heading.props.children
      expect(label.props.children).toBe(party.props.title.toUpperCase())
      labels.push(label.props.children)
      expect(label.props.style.fontFamily).toBe('Helvetica-Bold')
      const lines = rendered.props.children[1]
      const nameStyle = Array.isArray(lines[0].props.style) ? Object.assign({}, ...lines[0].props.style) : lines[0].props.style
      expect(lines[0].props.children).toBe(party.props.party.name)
      expect(nameStyle).toMatchObject({ fontFamily: 'Helvetica-Bold', color: '#252b33', fontSize: 11 })
      for (const line of lines.slice(1)) {
        expect(line.props.style.fontFamily).not.toBe('Helvetica-Bold')
        expect(line.props.style.color).not.toBe('#252b33')
      }
    }
    expect(labels).toEqual(['EMISOR', 'FACTURAR A'])
  })
  it('muestra cantidades enteras sin decimales y conserva cantidades fraccionarias y precios', async () => {
    const invoice = { ...createInvoiceDraft(), lines: ['23', '6', '15', '6.25'].map((quantity, i) => ({ description: `Caso ${['A', 'B', 'C', 'D'][i]}`, quantity, unitPrice: '1' })) }
    const text = visibleText(decodedStreams(await renderToBuffer(<InvoiceDocument invoice={invoice} />)))
    for (const row of ['CasoA231,00', 'CasoB61,00', 'CasoC151,00', 'CasoD6,251,00']) expect(text).toContain(row)
  }, 30000)
  it('wraps long unbroken concepts across multiple pages and repeats table headings', async () => {
    const invoice = { ...createInvoiceDraft(), lines: Array.from({ length: 100 }, (_, i) => ({ description: `Servicio ${i} ${'concepto'.repeat(60)}`, quantity: '1', unitPrice: '1' })) }
    const bytes = await renderToBuffer(<InvoiceDocument invoice={invoice} />)
    const source = bytes.toString('latin1')
    expect((source.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1)
    const text = visibleText(decodedStreams(bytes))
    expect(text.split('Concepto').length - 1).toBeGreaterThan(1)
    expect(text).toContain('114,95')
    const pageCount = (source.match(/\/Type \/Page\b/g) ?? []).length
    expect(text.split('TransportesAcevedoHernandez').length - 1).toBe(pageCount)
  }, 30000)
  it('rejects invalid data even when called directly', () => {
    expect(() => InvoiceDocument({ invoice: { ...createInvoiceDraft(), date: '2026-02-30' } })).toThrow()
  })
})
