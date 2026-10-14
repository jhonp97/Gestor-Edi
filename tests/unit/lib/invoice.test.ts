import { describe, expect, it } from 'vitest'
import { calculateInvoice, createInvoiceDraft, formatInvoiceMoney, invoiceSchema } from '@/lib/invoice'

const reference = () => ({ ...createInvoiceDraft(new Date('2026-09-12T12:00:00Z'), 13), lines: [25, 28, 5, 5].map((q, i) => ({ description: `Servicio ${i}`, quantity: String(q), unitPrice: i === 3 ? '30' : '185' })) })
describe('invoice domain', () => {
  it('matches the reference after discount then VAT', () => {
    expect(calculateInvoice(reference())).toEqual({ lines: ['4625.00', '5180.00', '925.00', '150.00'], subtotal: '10880.00', discount: '544.00', taxableBase: '10336.00', vat: '2170.56', total: '12506.56' })
  })
  it('defaults every party field, editable numbering, Madrid month end and leap year', () => {
    const draft = createInvoiceDraft(new Date('2024-02-15T00:00:00Z'), 7)
    expect(draft).toMatchObject({ number: 7, date: '2024-02-29', discountPercent: '5.00', vatPercent: '21.00', issuer: { name: 'Edimer Acevedo Quintero', taxId: 'Y6981735F', address: 'C/ Germanies 4/4', postalCode: '46900', city: 'Torrent, València' }, recipient: { name: 'Transportes Miguel Op. Logístico SL', taxId: 'B10556306', address: 'C/ Marqués del Turia, 16-5', postalCode: '46210', city: 'Picanya, València' } })
    expect(createInvoiceDraft(new Date('2026-01-31T23:30:00Z')).date).toBe('2026-02-28')
    expect(createInvoiceDraft().number).toBe(1)
  })
  it('normalizes decimals and rounds cents at each stage', () => {
    const invoice = invoiceSchema.parse({ ...reference(), discountPercent: '10', vatPercent: '0', lines: [{ description: 'Servicio', quantity: '0,5', unitPrice: '0,01' }] })
    expect(invoice.lines[0].quantity).toBe('0.50')
    expect(calculateInvoice(invoice)).toMatchObject({ lines: ['0.01'], discount: '0.00', total: '0.01' })
    expect(calculateInvoice({ ...reference(), discountPercent: '0', vatPercent: '10' }).total).toBe('11968.00')
    expect(formatInvoiceMoney('12506.56')).toBe('12.506,56 €')
  })
  it.each(['', 'NaN', '1e2', '-1', '0', '1.234', '1\n', '1000001'])('rejects invalid quantity %j', quantity => {
    expect(invoiceSchema.safeParse({ ...reference(), lines: [{ description: 'Servicio', quantity, unitPrice: '1' }] }).success).toBe(false)
  })
  it('rounds discount and VAT separately and supports large exact amounts', () => {
    expect(calculateInvoice({ ...reference(), lines: [{ description: 'Servicio', quantity: '1', unitPrice: '0.10' }], discountPercent: '5', vatPercent: '10' })).toMatchObject({ subtotal: '0.10', discount: '0.01', taxableBase: '0.09', vat: '0.01', total: '0.10' })
    expect(calculateInvoice({ ...reference(), lines: Array(100).fill({ description: 'Servicio', quantity: '1000000', unitPrice: '1000000' }), discountPercent: '0', vatPercent: '100' }).total).toBe('200000000000000.00')
    expect(invoiceSchema.safeParse({ ...reference(), date: '2000-02-29' }).success).toBe(true)
    expect(invoiceSchema.safeParse({ ...reference(), date: '1900-02-29' }).success).toBe(false)
    expect(() => calculateInvoice({ ...reference(), lines: [{ description: 'Servicio', quantity: '1', unitPrice: '1', extra: 1 }] } as never)).toThrow()
  })
  it.each(['2023-02-29', '2024-04-31', '2024-00-01', '0000-01-01'])('rejects date %s', date => expect(invoiceSchema.safeParse({ ...reference(), date }).success).toBe(false))
  it('rejects unknown fields, excessive lines/text, controls and percentages', () => {
    for (const value of [{ ...reference(), extra: 1 }, { ...reference(), issuer: { ...reference().issuer, extra: 1 } }, { ...reference(), lines: [] }, { ...reference(), lines: Array(101).fill(reference().lines[0]) }, { ...reference(), discountPercent: '100.01' }, { ...reference(), recipient: { ...reference().recipient, name: 'x\u0000' } }, { ...reference(), lines: [{ ...reference().lines[0], description: 'x'.repeat(501) }] }]) expect(invoiceSchema.safeParse(value).success).toBe(false)
  })
})
