'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { apiFetch } from '@/hooks/use-api'
import { invoiceSchema, createInvoiceDraft, calculateInvoice, formatInvoiceMoney, MAX_INVOICE_NUMBER, type Invoice } from '@/lib/invoice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type Account, type DraftStore, emptyDraftStore, readDraftStore, writeDraftStore, saveDraft, deleteDraft, suggestAfterDownload } from '@/lib/invoice-drafts'

// Remount the entire session on identity changes, including in-flight operations.
export function InvoiceEditor(account: Account) {
  return <AccountEditor key={JSON.stringify([account.orgId, account.userId])} {...account} />
}

type EditableInvoice = Omit<Invoice, 'number'> & { number: string }
const editable = (invoice: Invoice): EditableInvoice => ({
  ...invoice, number: String(invoice.number),
  lines: invoice.lines.map(line => ({ ...line, quantity: line.quantity.replace(/\.00$/, '') })),
})
const storageWarning = 'El almacenamiento local no está disponible o está lleno. Puede descargar el PDF sin guardar.'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    try { link.click() } finally { link.remove() }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function AccountEditor(account: Account) {
  const [draft, setDraft] = useState<EditableInvoice>(() => editable(createInvoiceDraft()))
  const [store, setStore] = useState<DraftStore>(emptyDraftStore)
  const storeRef = useRef(store)
  const [selected, setSelected] = useState<string>()
  const [ready, setReady] = useState(false)
  const [storageReadable, setStorageReadable] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const mounted = useRef(false)
  const operationPending = useRef(false)

  useEffect(() => {
    mounted.current = true
    try {
      const loaded = readDraftStore(window.localStorage, account)
      storeRef.current = loaded
      setStore(loaded)
      setDraft(editable(createInvoiceDraft(undefined, loaded.nextNumber)))
      setStorageReadable(true)
    } catch {
      setError(storageWarning)
    }
    setReady(true)
    return () => { mounted.current = false }
    // AccountEditor is keyed by identity and never reused for a different account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parsed = invoiceSchema.safeParse({ ...draft, number: /^\d+$/.test(draft.number) ? Number(draft.number) : NaN })
  const totals = parsed.success ? calculateInvoice(parsed.data) : null
  const duplicates = store.drafts.filter(item => item.id !== selected && String(item.invoice.number) === draft.number)

  function validated(): Invoice | undefined {
    setError('')
    setNotice('')
    if (!parsed.success) {
      setError(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(' · '))
      return
    }
    return parsed.data
  }

  function persist(next: DraftStore): boolean {
    if (!storageReadable) { setError(storageWarning); return false }
    try {
      writeDraftStore(window.localStorage, account, next)
      storeRef.current = next
      setStore(next)
      return true
    } catch {
      setError(storageWarning)
      return false
    }
  }

  function save() {
    const invoice = validated()
    if (!invoice) return
    try {
      const next = saveDraft(storeRef.current, invoice, selected)
      if (persist(next)) {
        setSelected(selected ?? next.drafts[next.drafts.length - 1].id)
        setNotice('Borrador guardado en este navegador.')
      }
    } catch {
      setError('No se puede guardar. Compruebe los datos y el límite de 20 borradores.')
    }
  }

  async function downloadPdf() {
    if (operationPending.current) return
    const invoice = validated()
    if (!invoice) return
    operationPending.current = true
    setPending(true)
    try {
      const response = await apiFetch('/api/invoices/pdf', { method: 'POST', body: JSON.stringify(invoice) })
      if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('application/pdf')) {
        throw new Error('Invalid PDF response')
      }
      const blob = await response.blob()
      if (!blob.size) throw new Error('Empty PDF')
      if (!mounted.current) return
      downloadBlob(blob, `factura-${invoice.number}.pdf`)
      const next = suggestAfterDownload(storeRef.current, invoice.number)
      // Retain the successful suggestion in this session even when disk storage fails.
      storeRef.current = next
      setStore(next)
      persist(next)
      setNotice('PDF descargado. El número de esta factura no ha cambiado.')
    } catch {
      if (mounted.current) setError('No se pudo descargar el PDF. Revise los datos o inténtelo de nuevo.')
    } finally {
      operationPending.current = false
      if (mounted.current) setPending(false)
    }
  }

  function changeParty(party: 'issuer' | 'recipient', field: keyof Invoice['issuer'], value: string) {
    setDraft(current => ({ ...current, [party]: { ...current[party], [field]: value } }))
  }

  return (
    <section className="space-y-6" aria-label="Editor de facturas">
      <div className="flex items-center justify-between gap-4">
        <div><p className="text-lg font-semibold">Transportes Acevedo Hernandez</p><h1 className="text-2xl font-bold">Facturas</h1></div>
        <Image src="/branding/transportes-acevedo-hernandez.png" alt="Transportes Acevedo Hernandez" width={120} height={80} className="h-auto w-24 sm:w-32" />
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-500 p-3 text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg border p-3">{notice}</p>}
      {draft.number === String(MAX_INVOICE_NUMBER) && <p role="status" className="text-amber-700">Se alcanzó el número máximo. No se propone otro número; revise la numeración antes de emitir otra factura.</p>}
      {duplicates.length > 0 && <p className="text-amber-700">Número repetido en otro borrador local. No se garantiza la unicidad entre dispositivos.</p>}
      <fieldset disabled={!ready || pending} className="space-y-6 disabled:opacity-70">
        <legend className="sr-only">Datos de la factura</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>Número de factura<Input value={draft.number} inputMode="numeric" onChange={event => setDraft({ ...draft, number: event.target.value })} /></label>
          <label>Fecha<Input type="date" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {(['issuer', 'recipient'] as const).map(party => {
            const title = party === 'issuer' ? 'Emisor' : 'Destinatario'
            return <fieldset key={party} className="space-y-3 rounded-lg border bg-card p-4">
              <legend className="px-2 font-semibold">{title}</legend>
              {([{ key: 'name', label: 'Nombre' }, { key: 'taxId', label: 'NIF/CIF' }, { key: 'address', label: 'Dirección' }, { key: 'postalCode', label: 'Código postal' }, { key: 'city', label: 'Ciudad' }] as const).map(field =>
                <label key={field.key} className="block">{title} · {field.label}<Input value={draft[party][field.key]} onChange={event => changeParty(party, field.key, event.target.value)} /></label>)}
            </fieldset>
          })}
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Conceptos</h2>
          {draft.lines.map((line, index) => <fieldset key={index} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
            <legend className="px-2">Concepto {index + 1}</legend>
            {([{ key: 'description', label: 'Descripción' }, { key: 'quantity', label: 'Cantidad' }, { key: 'unitPrice', label: 'Precio unitario' }] as const).map(field =>
              <label key={field.key}>{field.label} {index + 1}<Input inputMode={field.key === 'description' ? 'text' : 'decimal'} value={line[field.key]} onChange={event => setDraft(current => ({ ...current, lines: current.lines.map((item, position) => position === index ? { ...item, [field.key]: event.target.value } : item) }))} /></label>)}
            <div className="space-y-2"><p>Importe: {totals ? formatInvoiceMoney(totals.lines[index]) : '—'}</p><Button variant="outline" type="button" aria-label={`Eliminar concepto ${index + 1}`} disabled={draft.lines.length <= 1} onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, position) => position !== index) })}>Eliminar</Button></div>
          </fieldset>)}
          <Button type="button" variant="outline" disabled={draft.lines.length >= 100} onClick={() => setDraft({ ...draft, lines: [...draft.lines, { description: '', quantity: '1', unitPrice: '0' }] })}>Añadir concepto</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>Descuento (%)<Input inputMode="decimal" value={draft.discountPercent} onChange={event => setDraft({ ...draft, discountPercent: event.target.value })} /></label>
          <label>IVA (%)<Input inputMode="decimal" value={draft.vatPercent} onChange={event => setDraft({ ...draft, vatPercent: event.target.value })} /></label>
        </div>
        {!parsed.success && <p className="text-sm text-muted-foreground">Complete los datos válidos para calcular y descargar.</p>}
        <dl className="space-y-2 rounded-lg border bg-card p-4" aria-label="Totales">
          {([{ key: 'subtotal', label: 'Subtotal' }, { key: 'discount', label: 'Descuento' }, { key: 'taxableBase', label: 'Base imponible' }, { key: 'vat', label: 'IVA' }, { key: 'total', label: 'Total' }] as const).map(item =>
            <div key={item.key} className="flex justify-between gap-4"><dt>{item.label}</dt><dd data-testid={item.key} className={item.key === 'total' ? 'font-bold' : ''}>{totals ? formatInvoiceMoney(totals[item.key]) : '—'}</dd></div>)}
        </dl>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => { setDraft(editable(createInvoiceDraft(undefined, storeRef.current.nextNumber))); setSelected(undefined); setNotice(''); setError('') }}>Nueva factura</Button>
          <Button type="button" variant="outline" onClick={save}>Guardar borrador</Button>
        </div>
      </fieldset>
      <Button type="button" disabled={!ready || pending} onClick={() => void downloadPdf()}>{pending ? 'Descargando…' : 'Descargar PDF'}</Button>
      <section className="space-y-3" aria-label="Borradores guardados">
        <h2 className="text-xl font-semibold">Borradores guardados en este navegador</h2>
        {store.drafts.length === 0 && <p>No hay borradores guardados.</p>}
        <ul className="space-y-3">{store.drafts.map(item => <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <span>Factura {item.invoice.number} · {item.invoice.date} · {item.invoice.recipient.name}</span>
          <Button type="button" variant="outline" disabled={pending} aria-label={`Abrir factura ${item.invoice.number}`} onClick={() => { setDraft(editable(item.invoice)); setSelected(item.id); setError(''); setNotice('Borrador abierto; conserva su número original.') }}>Abrir</Button>
          <Button type="button" variant="outline" disabled={pending} aria-label={`Eliminar factura ${item.invoice.number}`} onClick={() => { if (window.confirm('¿Eliminar este borrador local?')) { if (persist(deleteDraft(storeRef.current, item.id)) && selected === item.id) setSelected(undefined) } }}>Eliminar</Button>
        </li>)}</ul>
      </section>
    </section>
  )
}
