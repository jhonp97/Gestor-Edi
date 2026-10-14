import { z } from 'zod'
import { invoiceSchema, MAX_INVOICE_NUMBER, type Invoice } from '@/lib/invoice'

// Covers the strict schema's maximum UTF-8 text payload, including JSON formatting.
export const MAX_TRANSFER_BYTES = 200000
export const MAX_DRAFTS = 20
const MAX_STORE_BYTES = 2 * 1024 * 1024
const draftSchema = z.object({ id: z.string().min(1).max(100), invoice: invoiceSchema }).strict()
const storeSchema = z.object({
  version: z.literal(1),
  nextNumber: z.number().int().min(1).max(MAX_INVOICE_NUMBER),
  drafts: z.array(draftSchema).max(MAX_DRAFTS),
}).strict().refine(value => new Set(value.drafts.map(draft => draft.id)).size === value.drafts.length)
const transferSchema = z.object({ version: z.literal(1), invoice: invoiceSchema }).strict()
export type DraftStore = z.infer<typeof storeSchema>
export type Account = { orgId: string; userId: string }
export const emptyDraftStore = (): DraftStore => ({ version: 1, nextNumber: 1, drafts: [] })

export function draftStorageKey(account: Account) {
  return `invoice-drafts:v1:${encodeURIComponent(account.orgId)}:${encodeURIComponent(account.userId)}`
}

function parseBounded<T>(text: string, maximum: number, schema: z.ZodType<T>): T {
  if (text.length > maximum || new TextEncoder().encode(text).byteLength > maximum) {
    throw new Error('El archivo supera el tamaño permitido.')
  }
  try {
    return schema.parse(JSON.parse(text))
  } catch {
    throw new Error('Los datos de la factura no son válidos.')
  }
}

export function readDraftStore(storage: Storage, account: Account): DraftStore {
  const text = storage.getItem(draftStorageKey(account))
  return text === null ? emptyDraftStore() : parseBounded(text, MAX_STORE_BYTES, storeSchema)
}

export function writeDraftStore(storage: Storage, account: Account, store: DraftStore) {
  const validated = storeSchema.parse(store)
  const text = JSON.stringify(validated)
  if (new TextEncoder().encode(text).byteLength > MAX_STORE_BYTES) throw new Error('Demasiados datos locales.')
  storage.setItem(draftStorageKey(account), text)
}

export function saveDraft(store: DraftStore, invoice: Invoice, id?: string): DraftStore {
  const validated = invoiceSchema.parse(invoice)
  if (!id && store.drafts.length >= MAX_DRAFTS) throw new Error('Máximo de 20 borradores. Elimine uno antes de guardar.')
  const draft = { id: id ?? crypto.randomUUID(), invoice: validated }
  const existing = store.drafts.some(item => item.id === draft.id)
  return storeSchema.parse({ ...store, drafts: existing
    ? store.drafts.map(item => item.id === draft.id ? draft : item)
    : [...store.drafts, draft] })
}

export function deleteDraft(store: DraftStore, id: string): DraftStore {
  return { ...store, drafts: store.drafts.filter(draft => draft.id !== id) }
}

export function suggestAfterDownload(store: DraftStore, number: number): DraftStore {
  if (!Number.isSafeInteger(number) || number < 1 || number > MAX_INVOICE_NUMBER) {
    throw new Error('Número de factura fuera de rango.')
  }
  return { ...store, nextNumber: Math.min(MAX_INVOICE_NUMBER, Math.max(store.nextNumber, number + 1)) }
}

export function exportInvoice(invoice: Invoice): string {
  const text = JSON.stringify(transferSchema.parse({ version: 1, invoice }), null, 2)
  if (new TextEncoder().encode(text).byteLength > MAX_TRANSFER_BYTES) {
    throw new Error('El archivo supera el tamaño permitido.')
  }
  return text
}

export function importInvoice(text: string): Invoice {
  return parseBounded(text, MAX_TRANSFER_BYTES, transferSchema).invoice
}
