import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { cleanClient } from '../../scripts/run-local-staging.mjs'

const ORIGIN = 'http://localhost:3000'

async function restrictToOwnedApp(context: BrowserContext) {
  const blocked: string[] = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== ORIGIN) {
      blocked.push('external-request')
      await route.abort('blockedbyclient')
    } else await route.continue()
  })
  return blocked
}

async function register(page: Page, email: string, password: string) {
  await page.goto('/register')
  const status = await page.evaluate(async ({ email, password }) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Owned staging owner', email, password, confirmPassword: password }),
    })
    // Do not transport or log the returned password token.
    return response.status
  }, { email, password })
  expect(status).toBe(201)
}

async function api(page: Page, url: string, method = 'GET', body?: object) {
  return page.evaluate(async ({ url, method, body }) => {
    const response = await fetch(url, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: response.status, body: await response.json() }
  }, { url, method, body })
}

// A single nonconditional Chromium scenario: no seed, Prisma imports, auth mocks,
// OAuth, client-token fallback, retries, or production links.
test('real password cookie session creates and reads a tenant-owned truck workday', async ({ page, context, browser }) => {
  const blocked = await restrictToOwnedApp(context)
  const anonymous = await browser.newContext({ baseURL: ORIGIN, serviceWorkers: 'block' })
  const other = await browser.newContext({ baseURL: ORIGIN, serviceWorkers: 'block' })
  const anonymousBlocked = await restrictToOwnedApp(anonymous)
  const otherBlocked = await restrictToOwnedApp(other)
  try {
    const denied = await anonymous.newPage()
    await denied.goto('/dashboard')
    await expect(denied).toHaveURL(`${ORIGIN}/login`)
    expect((await api(denied, '/api/auth/session')).status).toBe(401)
    expect((await api(denied, '/api/workers')).status).toBe(401)

    const suffix = randomBytes(6).toString('hex')
    const email = `staging-${suffix}@example.invalid`
    const password = randomBytes(24).toString('hex')
    await register(page, email, password)
    // Registration does not serve as login proof: remove its cookie first.
    await context.clearCookies()
    await page.evaluate(cleanClient, undefined)
    await page.goto('/login')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    const loginResponse = page.waitForResponse(response =>
      response.url() === `${ORIGIN}/api/auth/login` && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click()
    expect((await loginResponse).status()).toBe(200)
    await expect(page).toHaveURL(`${ORIGIN}/dashboard`)
    const cookie = (await context.cookies(ORIGIN)).find(value => value.name === 'auth-token')
    // Booleans only, so a failed assertion cannot print the token value.
    expect(cookie !== undefined).toBe(true)
    expect(cookie?.httpOnly === true).toBe(true)
    expect(cookie?.secure === true).toBe(true)
    expect(cookie?.sameSite === 'Lax').toBe(true)
    await page.evaluate(cleanClient, undefined)
    let headerFallback = false
    context.on('request', request => {
      const headers = request.headers()
      if ('x-auth-token' in headers || 'authorization' in headers) headerFallback = true
    })
    const sessionRequest = page.waitForRequest(request => request.url() === `${ORIGIN}/api/auth/session`)
    const session = await api(page, '/api/auth/session')
    const sentHeaders = await (await sessionRequest).allHeaders()
    expect('x-auth-token' in sentHeaders).toBe(false)
    expect('authorization' in sentHeaders).toBe(false)
    expect(sentHeaders.cookie?.includes('auth-token=') === true).toBe(true)
    expect(session.status).toBe(200)
    expect(session.body.user.email).toBe(email)
    expect(typeof session.body.user.organizationId).toBe('string')
    expect(session.body.user.organizationId.length).toBeGreaterThan(0)

    const today = new Date().toISOString().slice(0, 10)
    const month = today.slice(0, 7)
    const truck = await api(page, '/api/trucks', 'POST', {
      plate: 'STAGE-01', brand: 'Staging', model: 'Truck', year: 2025, status: 'ACTIVE',
    })
    expect(truck.status).toBe(201)
    expect(truck.body.id).toMatch(/^[a-f0-9-]{36}$/)
    const worker = await api(page, '/api/workers', 'POST', {
      name: 'Owned staging driver', dni: '12345678Z', docType: 'DNI', position: 'Conductor',
      baseSalary: 1500, startDate: `${today}T00:00:00.000Z`, truckId: truck.body.id,
    })
    expect(worker.status).toBe(201)
    expect(worker.body.id).toMatch(/^[a-f0-9-]{36}$/)
    await page.goto(`/workers/${worker.body.id}`)
    await expect(page.getByRole('heading', { name: 'Owned staging driver', exact: true })).toBeVisible()
    await page.getByLabel('Tarifa diaria', { exact: true }).fill('75.25')
    await page.getByRole('button', { name: 'Guardar tarifa', exact: true }).click()
    await expect(page.getByText('Tarifa diaria guardada.', { exact: true })).toBeVisible()

    await page.goto(`/trucks/${truck.body.id}`)
    await expect(page.getByRole('heading', { name: 'Staging Truck (2025)', exact: true })).toBeVisible()
    await page.getByLabel('Trabajador', { exact: true }).selectOption(worker.body.id)
    await page.getByLabel('Fecha', { exact: true }).fill(today)
    await expect(page.getByRole('status').filter({ hasText: 'Nueva jornada:' })).toBeVisible()
    await page.getByLabel('Empresa', { exact: true }).fill('Owned staging company')
    await page.getByLabel('Kilómetros del camión principal', { exact: true }).fill('120')
    const saveResponse = page.waitForResponse(response => response.request().method() === 'PUT' &&
      response.url() === `${ORIGIN}/api/workers/${worker.body.id}/operations/days/${today}`)
    await page.getByRole('button', { name: 'Guardar jornada', exact: true }).click()
    expect((await saveResponse).status()).toBe(200)
    await expect(page.getByRole('status').filter({ hasText: 'Jornada guardada correctamente.' })).toBeVisible()
    const operation = await api(page, `/api/workers/${worker.body.id}/operations/days/${today}`)
    expect(operation.status).toBe(200)
    expect(operation.body).toEqual({
      date: today, rateSnapshot: '75.25', operation: {
        companyName: 'Owned staging company', segments: [
          { truckId: truck.body.id, share: 100, kilometers: '120', incident: null },
        ],
      },
    })
    const readback = await api(page, `/api/workers/${worker.body.id}/daily-pay?periodStart=${month}-01`)
    expect(readback.status).toBe(200)
    expect(readback.body.days).toEqual([{ date: today, rateSnapshot: '75.25' }])
    expect(readback.body.totals).toEqual({ accrued: '75.25' })
    await page.goto(`/workers/${worker.body.id}`)
    await expect(page.getByRole('list', { name: 'Días trabajados' })).toContainText(today)
    await expect(page.getByText('Owned staging company', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quitar día', exact: true })).toBeDisabled()
    await page.goto(`/trucks/report?month=${month}&truck=all&period=month`)
    await expect(page.getByText('Jornadas únicas de trabajadores: 1', { exact: true })).toBeVisible()
    await expect(page.getByText('Ingresos registrados de la selección: €0.00', { exact: true })).toBeVisible()
    const rows = page.getByRole('region', { name: 'Jornadas atribuidas', exact: true })
    await expect(rows).toContainText('STAGE-01')
    await expect(rows).toContainText('Owned staging company')
    await expect(rows).toContainText('Owned staging driver')
    await expect(rows).toContainText('100%')
    await expect(rows).toContainText('120 km')

    const foreign = await other.newPage()
    await register(foreign, `other-${suffix}@example.invalid`, password)
    await foreign.evaluate(cleanClient, undefined)
    expect((await api(foreign, '/api/auth/session')).status).toBe(200)
    expect((await api(foreign, `/api/workers/${worker.body.id}/operations/days/${today}`)).status).toBe(404)
    expect((await api(foreign, `/api/workers/${worker.body.id}/daily-pay?periodStart=${month}-01`)).status).toBe(404)
    expect((await api(foreign, '/api/workers')).body).toEqual([])
    const foreignReport = await foreign.goto(`/trucks/report?month=${month}&truck=${truck.body.id}`)
    expect(foreignReport?.status()).toBe(404)
    expect(headerFallback).toBe(false)
    expect(await page.evaluate(() => localStorage.getItem('auth-token'))).toBeNull()
    expect(blocked.length + anonymousBlocked.length + otherBlocked.length).toBe(0)
  } finally {
    await other.close()
    await anonymous.close()
  }
})
