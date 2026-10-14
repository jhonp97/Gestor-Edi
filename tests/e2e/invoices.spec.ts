import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

/**
 * Run only against an isolated authenticated test server: getSessionUniversal
 * and the app layout must return a fixed synthetic org/user without database
 * access. Browser route mocks cannot authenticate a Server Component. This file
 * does not register/login/create users or write a real database. Use
 * node scripts/run-invoice-browser-smoke.mjs for that isolated test server.
 */
test.describe('Facturas locales (servidor autenticado aislado)', () => {
  test.beforeEach(async ({ page }) => {
    const started = Date.now()
    page.on('pageerror', error => console.log(`Browser runtime error: ${error.message.slice(0, 600)}`))
    page.on('requestfailed', request => console.log(`Failed resource: ${new URL(request.url()).pathname} ${request.failure()?.errorText}`))
    await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id: 'invoice-test', name: 'Prueba', role: 'USER' } } }))
    await page.goto('/facturas')
    await expect(page.getByRole('heading', { name: 'Facturas', exact: true })).toBeVisible()
    await expect(page.getByLabel('Número de factura', { exact: true })).toBeEnabled({ timeout: 15000 })
    console.log(`Initial editor hydrated in ${Date.now() - started}ms`)
  })

  test('editor móvil, guardado, recarga, transferencia JSON y descarga PDF', async ({ page }, testInfo) => {
    const started = Date.now()
    const storageKey = 'invoice-drafts:v1:invoice-org:invoice-test'
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await page.getByRole('link', { name: 'Facturas', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()
    await page.getByLabel('Número de factura', { exact: true }).fill('13')
    await page.getByLabel('Fecha', { exact: true }).fill('2026-09-30')
    await page.getByLabel('Descripción 1', { exact: true }).fill('Transporte de prueba')
    await page.getByLabel('Cantidad 1', { exact: true }).fill('25')
    await page.getByLabel('Precio unitario 1', { exact: true }).fill('185')
    await page.getByRole('button', { name: 'Añadir concepto' }).click()
    await page.getByLabel('Descripción 2', { exact: true }).fill('Extra')
    await page.getByLabel('Cantidad 2', { exact: true }).fill('5')
    await page.getByLabel('Precio unitario 2', { exact: true }).fill('30')
    await page.getByRole('button', { name: 'Eliminar concepto 2' }).click()
    for (const [index, description, quantity, price] of [[2, 'FedEx', '28', '185'], [3, 'Logística', '5', '185'], [4, 'Extras Palibex', '5', '30']] as const) {
      await page.getByRole('button', { name: 'Añadir concepto' }).click()
      await page.getByLabel(`Descripción ${index}`, { exact: true }).fill(description)
      await page.getByLabel(`Cantidad ${index}`, { exact: true }).fill(quantity)
      await page.getByLabel(`Precio unitario ${index}`, { exact: true }).fill(price)
    }
    await expect(page.getByTestId('total')).toContainText('12.506,56')
    await page.screenshot({ path: testInfo.outputPath('mobile-editor.png'), fullPage: true })
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Borrador guardado' })).toBeVisible()
    const saved = await page.evaluate(key => localStorage.getItem(key), storageKey)
    expect(saved).not.toBeNull()
    expect(JSON.parse(saved!).drafts[0].invoice.number).toBe(13)
    console.log(`Reference edited and saved after ${Date.now() - started}ms`)
    const reloadStarted = Date.now()
    await page.reload()
    console.log(`Reload document loaded in ${Date.now() - reloadStarted}ms`)
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(saved)
    await expect(page.getByLabel('Número de factura', { exact: true })).toBeEnabled({ timeout: 15000 })
    console.log(`Reload editor hydrated in ${Date.now() - reloadStarted}ms`)
    await page.getByRole('button', { name: 'Abrir factura 13', exact: true }).click()
    await expect(page.getByLabel('Número de factura', { exact: true })).toHaveValue('13')
    await expect(page.getByLabel('Descripción 1', { exact: true })).toHaveValue('Transporte de prueba')
    const jsonDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar JSON' }).click()
    const transfer = await jsonDownload
    const transferPath = await transfer.path()
    if (!transferPath) throw new Error('Missing JSON download')
    await page.getByRole('button', { name: 'Nueva factura' }).click()
    await page.getByLabel('Importar JSON', { exact: true }).setInputFiles(transferPath)
    await expect(page.getByRole('status').filter({ hasText: 'Borrador importado' })).toBeVisible()
    await expect(page.getByLabel('Número de factura', { exact: true })).toHaveValue('13')
    await expect(page.getByText(/Número repetido/)).toBeVisible()
    const pdfDownload = page.waitForEvent('download', { timeout: 45000 }).catch(() => null)
    const pdfResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/invoices/pdf' && response.request().method() === 'POST', { timeout: 45000 })
    await page.getByRole('button', { name: 'Descargar PDF' }).click()
    const response = await pdfResponse
    console.log(`PDF endpoint returned${response.status()}`)
    expect(response.status()).toBe(200)
    const pdf = await pdfDownload
    if (!pdf) throw new Error('PDF HTTP request succeeded but no browser download occurred')
    expect(pdf.suggestedFilename()).toBe('factura-13.pdf')
    const pdfPath = await pdf.path()
    if (!pdfPath) throw new Error('Missing PDF download')
    const bytes = await readFile(pdfPath)
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.toString('latin1')).toContain('/Subtype /Image')
    await pdf.saveAs(testInfo.outputPath('reference-invoice.pdf'))
    await page.getByRole('button', { name: 'Nueva factura' }).click()
    await expect(page.getByLabel('Número de factura', { exact: true })).toHaveValue('14')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
