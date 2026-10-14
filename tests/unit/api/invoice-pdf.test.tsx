// @vitest-environment node
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInvoiceDraft } from '@/lib/invoice'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), render: vi.fn() }))
vi.mock('@/lib/auth-edge', () => ({ getUserFromRequest: mocks.auth }))
vi.mock('@react-pdf/renderer', () => ({ renderToBuffer: mocks.render }))
vi.mock('@/lib/pdf/invoice-document', () => ({ InvoiceDocument: () => React.createElement('div') }))
import { POST } from '@/app/api/invoices/pdf/route'

function request(body: unknown = createInvoiceDraft(), headers: Record<string, string> = {}) {
  return new Request('https://flota.test/api/invoices/pdf', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://flota.test', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })
}

describe('invoice PDF endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user', organizationId: 'org' })
    mocks.render.mockResolvedValue(Buffer.from('%PDF-1.7\nfixture'))
  })
  it('authenticates before parsing and requires an organization', async () => {
    for (const user of [null, { userId: 'user' }, { organizationId: 'org' }]) {
      mocks.auth.mockResolvedValue(user)
      const response = await POST(request('{'))
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Debes iniciar sesión para descargar la factura.' })
    }
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it('downloads a private PDF with safe filename and validated normalized data', async () => {
    const invoice = { ...createInvoiceDraft(new Date('2026-09-01T00:00:00Z'), 13), lines: [{ description: 'Servicio', quantity: '25', unitPrice: '185,00' }] }
    const response = await POST(request(invoice))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="Factura-13-2026-09-30.pdf"')
    expect(Buffer.from(await response.arrayBuffer()).toString()).toContain('%PDF-')
    expect(mocks.render.mock.calls[0][0].props.invoice.lines[0].unitPrice).toBe('185.00')
  })
  it('uses the validated public Host when Next reconstructs an internal URL', async () => {
    const req = new Request('http://localhost:3118/api/invoices/pdf', {
      method: 'POST', headers: { host: '127.0.0.1:3118', origin: 'http://127.0.0.1:3118', 'content-type': 'application/json' },
      body: JSON.stringify(createInvoiceDraft()),
    })
    const response = await POST(req)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(Buffer.from(await response.arrayBuffer()).toString()).toContain('%PDF-')
    expect(mocks.render).toHaveBeenCalledOnce()
  })
  it('does not accept an internal or forwarded origin instead of the public Host', async () => {
    for (const origin of ['http://localhost:3118', 'https://evil.test']) {
      const req = new Request('http://localhost:3118/api/invoices/pdf', {
        method: 'POST', headers: { host: '127.0.0.1:3118', origin, 'x-forwarded-host': 'evil.test', 'content-type': 'application/json' },
        body: JSON.stringify(createInvoiceDraft()),
      })
      const response = await POST(req)
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'La solicitud no está permitida.' })
    }
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it('rejects malformed Host metadata without rendering', async () => {
    for (const host of ['flota.test/path', 'evil.test@flota.test', 'flota.test:999999', 'flota.test,evil.test']) {
      const response = await POST(request(undefined, { host }))
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'La solicitud no está permitida.' })
    }
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it('supports same-origin browser requests without Origin only with same-origin metadata', async () => {
    const req = request()
    req.headers.delete('origin')
    req.headers.set('sec-fetch-site', 'same-origin')
    expect((await POST(req)).status).toBe(200)
  })
  it.each<Record<string, string>>([{ origin: 'https://evil.test' }, { origin: 'null' }, { 'sec-fetch-site': 'cross-site' }])('rejects cross-origin requests %j', async headers => {
    expect((await POST(request(undefined, headers))).status).toBe(403)
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it('rejects missing origin evidence', async () => {
    const req = request(); req.headers.delete('origin')
    expect((await POST(req)).status).toBe(403)
  })
  it.each(['text/plain', 'application/jsonp'])('requires JSON media type %s', async type => {
    expect((await POST(request(undefined, { 'content-type': type }))).status).toBe(415)
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it.each(['{', '', JSON.stringify({ ...createInvoiceDraft(), totals: { total: '1' } }), JSON.stringify({ ...createInvoiceDraft(), date: '2026-02-30' }), JSON.stringify({ ...createInvoiceDraft(), lines: [{ description: 'bad\u0000', quantity: '1', unitPrice: '1' }] })])('rejects invalid body without rendering', async body => {
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Los datos de la factura no son válidos.' })
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it.each<Record<string, string>>([{}, { 'content-length': '1' }, { 'content-length': '200001' }])('bounds actual bytes, including absent/lying length %j', async headers => {
    const response = await POST(request(' '.repeat(200001), headers))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'La factura supera el tamaño permitido.' })
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it('bounds accumulated stream bytes and cancels before reading further', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(100000))
        controller.enqueue(new Uint8Array(100001))
      }, cancel,
    })
    const req = new Request('https://flota.test/api/invoices/pdf', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://flota.test' }, body: stream, duplex: 'half' } as RequestInit)
    expect((await POST(req)).status).toBe(413)
    expect(cancel).toHaveBeenCalledOnce()
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it('rejects invalid UTF-8 and accepts JSON charset parameters', async () => {
    const req = new Request('https://flota.test/api/invoices/pdf', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://flota.test' }, body: new Uint8Array([0xff]) })
    expect((await POST(req)).status).toBe(400)
    expect(mocks.render).not.toHaveBeenCalled()
    expect((await POST(request(undefined, { 'content-type': 'application/json; charset=utf-8' }))).status).toBe(200)
  })
  it('returns generic private failures without disclosing renderer errors', async () => {
    mocks.render.mockRejectedValue(new Error('private invoice data'))
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ error: 'No se pudo generar la factura. Inténtalo de nuevo.' })
  })
})
