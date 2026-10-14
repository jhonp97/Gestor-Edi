import { renderToBuffer } from '@react-pdf/renderer'
import { getUserFromRequest } from '@/lib/auth-edge'
import { invoiceSchema } from '@/lib/invoice'
import { InvoiceDocument } from '@/lib/pdf/invoice-document'

export const runtime = 'nodejs'
const MAX_BYTES = 200000
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }

function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status, headers: privateHeaders })
}

function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') return false
  const origin = request.headers.get('origin')
  if (!origin) return site === 'same-origin'
  try {
    const url = new URL(request.url)
    // Next may reconstruct request.url with an internal hostname. Host is the
    // browser-facing authority; do not trust forwarded hosts or the Origin itself.
    const host = request.headers.get('host')
    if (host !== null && !/^(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::\d{1,5})?$/i.test(host)) return false
    const publicOrigin = host === null ? url.origin : new URL(`${url.protocol}//${host}`).origin
    return origin === publicOrigin
  } catch {
    return false
  }
}

class BodyTooLarge extends Error {}

async function boundedBody(request: Request): Promise<string> {
  const declared = request.headers.get('content-length')
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) throw new Error('Invalid length')
    if (Number(declared) > MAX_BYTES) throw new BodyTooLarge()
  }
  if (!request.body) throw new Error('Missing body')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_BYTES) {
        // Cancellation need not finish before rejecting a hostile stream.
        void reader.cancel().catch(() => {})
        throw new BodyTooLarge()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user?.userId || !user.organizationId) {
      return errorResponse(401, 'Debes iniciar sesión para descargar la factura.')
    }
    if (!isSameOrigin(request)) return errorResponse(403, 'La solicitud no está permitida.')
    const mediaType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (mediaType !== 'application/json') return errorResponse(415, 'Envía la factura en formato JSON.')
    let body: unknown
    try {
      body = JSON.parse(await boundedBody(request))
    } catch (error) {
      if (error instanceof BodyTooLarge) return errorResponse(413, 'La factura supera el tamaño permitido.')
      return errorResponse(400, 'Los datos de la factura no son válidos.')
    }
    const result = invoiceSchema.safeParse(body)
    if (!result.success) return errorResponse(400, 'Los datos de la factura no son válidos.')
    // InvoiceDocument revalidates and recomputes; client totals are never trusted.
    const bytes = await renderToBuffer(<InvoiceDocument invoice={result.data} />)
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...privateHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Factura-${result.data.number}-${result.data.date}.pdf"`,
      },
    })
  } catch {
    return errorResponse(500, 'No se pudo generar la factura. Inténtalo de nuevo.')
  }
}
