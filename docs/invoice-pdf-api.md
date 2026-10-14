# Invoice PDF endpoint

`POST /api/invoices/pdf` generates a PDF without storing an invoice in the database.

- Requires an authenticated user with an organization; authentication runs before parsing.
- Accepts `application/json`, including charset parameters, up to 200,000 actual streamed bytes.
- The payload must match `invoiceSchema` in `src/lib/invoice.ts`; unknown properties and client totals are rejected.
- Monetary values are decimal strings with at most two decimal places. Each line is rounded to cents; discount precedes VAT.
- The server revalidates and recalculates before rendering. Branding uses only the fixed local asset.
- Successful responses are `application/pdf`, `private, no-store`, with a safe invoice-number/date filename.

## Origin boundary

Browser requests must be same-origin. The expected authority comes from the validated public `Host`, not Next's reconstructed internal hostname or `x-forwarded-host`. The protocol comes from the request URL. Deployments must preserve the public Host and correct protocol. Without Origin, only `sec-fetch-site: same-origin` provides accepted evidence.

## Errors

JSON errors use `{ "error": "<Spanish message>" }` and private/no-store headers: 401 unauthenticated, 403 origin rejected, 415 unsupported media type, 413 oversized body, 400 invalid invoice/JSON/UTF-8, 500 generation failure. Errors do not disclose invoice data or renderer details.

## Verification and rollback

Public endpoint tests cover authentication, origin/public-host rejection boundaries, byte limits, validation and responses. Real React-PDF tests cover branded A4 and multipage rendering; the isolated browser test downloads the actual PDF. Synthetic fixtures do not verify production JWT/session configuration or visual clipping.

Rollback this unit by removing the endpoint, PDF document, this guide and their tests; it does not change database records or schemas.
