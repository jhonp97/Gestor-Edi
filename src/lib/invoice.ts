import { z } from 'zod'

export const MAX_INVOICE_NUMBER = 999999999

const ZERO = BigInt(0)
const HUNDRED = BigInt(100)
const controls = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/

function scaled(value: string): bigint {
  const [whole, fraction = ''] = value.replace(',', '.').split('.')
  return BigInt(whole) * HUNDRED + BigInt(fraction.padEnd(2, '0'))
}

function fixed(value: bigint): string {
  return `${value / HUNDRED}.${(value % HUNDRED).toString().padStart(2, '0')}`
}

function decimal(max: number, positive = false) {
  return z.string().min(1).max(10)
    .refine(value => !controls.test(value) && /^[0-9]+(?:[.,][0-9]{1,2})?$/.test(value), 'Introduce un decimal válido.')
    .pipe(z.string().transform(value => scaled(value)))
    .refine(value => value >= (positive ? BigInt(1) : ZERO) && value <= BigInt(max) * HUNDRED, 'Valor fuera de rango.')
    .transform(fixed)
}

function text(max: number) {
  return z.string().min(1).max(max).refine(value => !controls.test(value) && value.trim().length > 0, 'Introduce un texto válido.').transform(value => value.trim())
}

const partySchema = z.object({
  name: text(150), taxId: text(30), address: text(200), postalCode: text(20), city: text(100),
}).strict()

function validDate(value: string): boolean {
  if (controls.test(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}

export const invoiceSchema = z.object({
  number: z.number().int().min(1).max(MAX_INVOICE_NUMBER),
  date: z.string().length(10).refine(validDate, 'Fecha no válida.'),
  issuer: partySchema,
  recipient: partySchema,
  lines: z.array(z.object({ description: text(500), quantity: decimal(1000000, true), unitPrice: decimal(1000000) }).strict()).min(1).max(100),
  discountPercent: decimal(100),
  vatPercent: decimal(100),
}).strict()

export type Invoice = z.infer<typeof invoiceSchema>

export function createInvoiceDraft(now: Date = new Date(), number: number = 1): Invoice {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).formatToParts(now)
  const year = Number(parts.find(part => part.type === 'year')!.value)
  const month = Number(parts.find(part => part.type === 'month')!.value)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const day = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  return invoiceSchema.parse({
    number, date: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${day}`,
    issuer: { name: 'Edimer Acevedo Quintero', taxId: 'Y6981735F', address: 'C/ Germanies 4/4', postalCode: '46900', city: 'Torrent, València' },
    recipient: { name: 'Transportes Miguel Op. Logístico SL', taxId: 'B10556306', address: 'C/ Marqués del Turia, 16-5', postalCode: '46210', city: 'Picanya, València' },
    lines: [{ description: 'Servicio de transporte', quantity: '1.00', unitPrice: '0.00' }],
    discountPercent: '5.00', vatPercent: '21.00',
  })
}

function roundDivide(value: bigint, divisor: bigint): bigint {
  return (value + divisor / BigInt(2)) / divisor
}

export function calculateInvoice(invoice: Invoice) {
  const parsed = invoiceSchema.parse(invoice)
  const lines = parsed.lines.map(line => roundDivide(scaled(line.quantity) * scaled(line.unitPrice), HUNDRED))
  const subtotal = lines.reduce((sum, line) => sum + line, ZERO)
  const discount = roundDivide(subtotal * scaled(parsed.discountPercent), BigInt(10000))
  const taxableBase = subtotal - discount
  const vat = roundDivide(taxableBase * scaled(parsed.vatPercent), BigInt(10000))
  return { lines: lines.map(fixed), subtotal: fixed(subtotal), discount: fixed(discount), taxableBase: fixed(taxableBase), vat: fixed(vat), total: fixed(taxableBase + vat) }
}

export function formatInvoiceMoney(value: string): string {
  if (controls.test(value) || !/^\d+\.\d{2}$/.test(value)) throw new Error('Importe no válido.')
  const [whole, fraction] = value.split('.')
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}\u00a0€`
}
