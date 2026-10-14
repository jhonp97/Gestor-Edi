import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createInvoiceDraft, invoiceSchema } from '@/lib/invoice'
import { draftStorageKey, emptyDraftStore, readDraftStore, writeDraftStore, saveDraft, deleteDraft, suggestAfterDownload, importInvoice, exportInvoice, MAX_TRANSFER_BYTES, MAX_DRAFTS } from '@/lib/invoice-drafts'

const account = { orgId: 'org', userId: 'user' }
const invoice = () => ({ ...createInvoiceDraft(), lines: [{ description: 'Servicio', quantity: '1', unitPrice: '185' }] })
beforeEach(() => localStorage.clear())
describe('Borradores locales', () => {
  it('separa organización y usuario sin enumerar otras claves', () => {
    const keySpy = vi.spyOn(Storage.prototype, 'key')
    writeDraftStore(localStorage, account, saveDraft(emptyDraftStore(), invoice()))
    expect(readDraftStore(localStorage, { ...account, userId: 'other' }).drafts).toEqual([])
    expect(readDraftStore(localStorage, { ...account, orgId: 'other' }).drafts).toEqual([])
    expect(keySpy).not.toHaveBeenCalled()
    keySpy.mockRestore()
    expect(draftStorageKey({ orgId: 'a:b', userId: 'c' })).not.toBe(draftStorageKey({ orgId: 'a', userId: 'b:c' }))
  })
  it('guarda, abre y elimina sin cambiar el número original', () => {
    const saved = saveDraft(emptyDraftStore(), { ...invoice(), number: 13 })
    writeDraftStore(localStorage, account, saved)
    const reopened = readDraftStore(localStorage, account)
    expect(reopened.drafts[0].invoice.number).toBe(13)
    expect(deleteDraft(reopened, reopened.drafts[0].id).drafts).toEqual([])
  })
  it('importa y exporta un sobre estricto preservando el número', () => {
    expect(importInvoice(exportInvoice({ ...invoice(), number: 13 })).number).toBe(13)
    const saved = saveDraft(emptyDraftStore(), invoice())
    const imported = saveDraft(saved, importInvoice(exportInvoice(invoice())))
    expect(imported.drafts).toHaveLength(2)
    expect(imported.drafts[0]).toEqual(saved.drafts[0])
  })
  it.each(['{', JSON.stringify({ version: 2, invoice: {} }), JSON.stringify({ version: 1, invoice: {}, extra: true }), 'x'.repeat(MAX_TRANSFER_BYTES + 1)])('rechaza JSON inválido o excesivo sin mutar datos: %s', text => {
    const store = saveDraft(emptyDraftStore(), invoice())
    const before = JSON.stringify(store)
    expect(() => importInvoice(text)).toThrow()
    expect(JSON.stringify(store)).toBe(before)
  })
  it('rechaza propiedades desconocidas dentro de la factura', () => {
    expect(() => importInvoice(JSON.stringify({ version: 1, invoice: { ...invoice(), extra: true } }))).toThrow()
  })
  it('limita la lista y valida al leer almacenamiento', () => {
    let store = emptyDraftStore()
    for (let i = 0; i < MAX_DRAFTS; i++) store = saveDraft(store, invoice())
    expect(() => saveDraft(store, invoice())).toThrow()
    localStorage.setItem(draftStorageKey(account), '{')
    expect(() => readDraftStore(localStorage, account)).toThrow()
  })
  it('propaga fallos de almacenamiento para que la UI avise', () => {
    const storage = { getItem: () => { throw new Error('unavailable') }, setItem: () => { throw new Error('quota') } } as unknown as Storage
    expect(() => readDraftStore(storage, account)).toThrow()
    expect(() => writeDraftStore(storage, account, emptyDraftStore())).toThrow()
  })
  it('mantiene utilizable el contador al alcanzar el número máximo', () => {
    const current = saveDraft(emptyDraftStore(), { ...invoice(), number: 999999999 })
    const next = suggestAfterDownload(current, 999999999)
    expect(next.nextNumber).toBe(999999999)
    writeDraftStore(localStorage, account, next)
    const reopened = readDraftStore(localStorage, account)
    expect(() => createInvoiceDraft(undefined, reopened.nextNumber)).not.toThrow()
    expect(reopened.drafts).toEqual(current.drafts)
    expect(suggestAfterDownload(reopened, 999999999).nextNumber).toBe(999999999)
  })
  it('exporta e importa una factura válida con todos los textos Unicode al máximo', () => {
    const party = { name: '漢'.repeat(150), taxId: '漢'.repeat(30), address: '漢'.repeat(200), postalCode: '漢'.repeat(20), city: '漢'.repeat(100) }
    const large = invoiceSchema.parse({
      ...invoice(), issuer: party, recipient: party,
      lines: Array.from({ length: 100 }, () => ({ description: '漢'.repeat(500), quantity: '1000000', unitPrice: '1000000' })),
    })
    const transfer = exportInvoice(large)
    expect(importInvoice(transfer)).toEqual(large)
    expect(new TextEncoder().encode(transfer).byteLength).toBeLessThanOrEqual(MAX_TRANSFER_BYTES)
    const before = saveDraft(emptyDraftStore(), invoice())
    writeDraftStore(localStorage, account, before)
    expect(() => importInvoice(' '.repeat(MAX_TRANSFER_BYTES + 1))).toThrow('El archivo supera el tamaño permitido.')
    expect(readDraftStore(localStorage, account)).toEqual(before)
  })
  it('sugiere monotonamente sin consumir números en descargas repetidas', () => {
    const store = suggestAfterDownload(emptyDraftStore(), 13)
    expect(store.nextNumber).toBe(14)
    expect(suggestAfterDownload(store, 13).nextNumber).toBe(14)
    expect(suggestAfterDownload(store, 1).nextNumber).toBe(14)
  })
})
