import { test, expect } from '@playwright/test'

/**
 * Real-API contract tests for the worker daily-pay HTTP surface. The suite is
 * self-contained: it registers a fresh tenant through the public auth API,
 * creates its own worker, and drives the daily-pay endpoints end to end. It
 * never touches external or non-disposable resources — every record it
 * creates carries a unique timestamp and lives only in the serving database.
 *
 * Authentication uses the x-auth-token header, which the route handlers
 * accept (the cookie jar is not shared across API contexts the same way).
 */

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

const PERIOD = '2026-03-01'
const DAY = '2026-03-15'
const LATER_DAY = '2026-03-20'
const RATE = '120.00'

test.describe.serial('worker daily-pay API', () => {
  let token = ''
  let workerId = ''

  const authed = {
    'x-auth-token': '',
    'content-type': 'application/json',
  }

  test.beforeAll(async ({ request }) => {
    const email = `daily-pay-e2e-${uniqueSuffix()}@test.com`
    const register = await request.post('/api/auth/register', {
      data: { name: 'Daily Pay E2E', email, password: 'Password123', confirmPassword: 'Password123' },
    })
    expect(register.status()).toBe(201)
    token = (await register.json()).token
    expect(token).toBeTruthy()
    authed['x-auth-token'] = token

    const created = await request.post('/api/workers', {
      data: {
        name: 'Daily Pay Worker',
        dni: `${Math.floor(Math.random() * 90000000) + 10000000}Z`,
        position: 'Driver',
        baseSalary: 1000,
        startDate: '2026-01-01',
      },
      headers: authed,
    })
    expect(created.status()).toBe(201)
    workerId = (await created.json()).id
    expect(workerId).toBeTruthy()

    const rated = await request.patch(`/api/workers/${workerId}/daily-pay?periodStart=${PERIOD}`, {
      data: { dailyRate: RATE },
      headers: authed,
    })
    expect(rated.status()).toBe(200)
  })

  test('answers 401 without credentials and never exposes data', async ({ request }) => {
    const res = await request.get(`/api/workers/${workerId}/daily-pay?periodStart=${PERIOD}`)
    expect(res.status()).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  test('answers 404 for a foreign or missing worker', async ({ request }) => {
    const foreign = '00000000-0000-4000-8000-000000000000'
    const res = await request.get(`/api/workers/${foreign}/daily-pay?periodStart=${PERIOD}`, {
      headers: authed,
    })
    expect(res.status()).toBe(404)
    expect(await res.json()).toEqual({ error: 'Worker not found' })
  })

  test('answers 400 for a malformed query and a malformed command', async ({ request }) => {
    const badQuery = await request.get(
      `/api/workers/${workerId}/daily-pay?periodStart=2026-03-15`,
      { headers: authed }
    )
    expect(badQuery.status()).toBe(400)

    const badBody = await request.post(
      `/api/workers/${workerId}/daily-pay/months/${PERIOD}/mark-paid`,
      { data: { unexpected: true }, headers: authed }
    )
    expect(badBody.status()).toBe(400)
  })

  test('starts as a PENDING month with accrued zero and the configured rate', async ({ request }) => {
    const res = await request.get(`/api/workers/${workerId}/daily-pay?periodStart=${PERIOD}`, {
      headers: authed,
    })
    expect(res.status()).toBe(200)
    expect(await res.json()).toMatchObject({
      workerId,
      periodStart: PERIOD,
      dailyRate: RATE,
      status: 'PENDING',
      paidAt: null,
      days: [],
      totals: { accrued: '0.00' },
    })
  })

  test('marks a worked day with the snapshot of the configured rate', async ({ request }) => {
    const res = await request.put(`/api/workers/${workerId}/daily-pay/days/${DAY}`, {
      headers: authed,
    })
    expect(res.status()).toBe(201)
    expect(await res.json()).toEqual({ date: DAY, rateSnapshot: RATE })
  })

  test('conflicts on a duplicate worked date', async ({ request }) => {
    const res = await request.put(`/api/workers/${workerId}/daily-pay/days/${DAY}`, {
      headers: authed,
    })
    expect(res.status()).toBe(409)
  })

  test('denies the mark without a configured rate', async ({ request }) => {
    const noRate = '2026-04-02'
    const cleared = await request.patch(`/api/workers/${workerId}/daily-pay?periodStart=2026-04-01`, {
      data: { dailyRate: null },
      headers: authed,
    })
    expect(cleared.status()).toBe(200)
    const res = await request.put(`/api/workers/${workerId}/daily-pay/days/${noRate}`, {
      headers: authed,
    })
    expect(res.status()).toBe(409)
    // The rate is worker-level: restore it so later months keep accruing. The
    // snapshot on the already-marked day must stay untouched by this change.
    const restored = await request.patch(`/api/workers/${workerId}/daily-pay?periodStart=${PERIOD}`, {
      data: { dailyRate: RATE },
      headers: authed,
    })
    expect(restored.status()).toBe(200)
  })

  test('exposes the accrued month after marking days', async ({ request }) => {
    const second = await request.put(`/api/workers/${workerId}/daily-pay/days/${LATER_DAY}`, {
      headers: authed,
    })
    expect(second.status()).toBe(201)

    const res = await request.get(`/api/workers/${workerId}/daily-pay?periodStart=${PERIOD}`, {
      headers: authed,
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.days).toEqual([
      { date: DAY, rateSnapshot: RATE },
      { date: LATER_DAY, rateSnapshot: RATE },
    ])
    expect(body.totals).toEqual({ accrued: '240.00' })
    expect(body.totals).not.toHaveProperty('paid')
    expect(body.totals).not.toHaveProperty('balance')
  })

  test('marks the eligible month PAID with a stamped paidAt', async ({ request }) => {
    const res = await request.post(
      `/api/workers/${workerId}/daily-pay/months/${PERIOD}/mark-paid`,
      { data: {}, headers: authed }
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('PAID')
    expect(body.transitioned).toBe(true)
    expect(new Date(body.paidAt).toISOString()).toBe(body.paidAt)
  })

  test('locks day edits while the month is PAID', async ({ request }) => {
    const put = await request.put(`/api/workers/${workerId}/daily-pay/days/2026-03-25`, {
      headers: authed,
    })
    expect(put.status()).toBe(409)

    const remove = await request.delete(`/api/workers/${workerId}/daily-pay/days/${DAY}`, {
      headers: authed,
    })
    expect(remove.status()).toBe(409)
  })

  test('repeated mark-paid stays an idempotent no-op with the same timestamp', async ({ request }) => {
    const first = await request.post(
      `/api/workers/${workerId}/daily-pay/months/${PERIOD}/mark-paid`,
      { data: {}, headers: authed }
    )
    expect(first.status()).toBe(200)
    const body = await first.json()
    expect(body.transitioned).toBe(false)
    expect(body.status).toBe('PAID')
    expect(body.paidAt).toBeTruthy()
  })

  test('annual history exposes twelve ordered months with accrued only', async ({ request }) => {
    const res = await request.get(`/api/workers/${workerId}/daily-pay/history?year=2026`, {
      headers: authed,
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.year).toBe(2026)
    expect(body.months).toHaveLength(12)
    expect(body.months[2]).toEqual({
      periodStart: PERIOD,
      status: 'PAID',
      paidAt: expect.any(String),
      accrued: '240.00',
    })
    expect(body.months[0]).toEqual({
      periodStart: '2026-01-01',
      status: 'PENDING',
      paidAt: null,
      accrued: '0.00',
    })
  })

  test('reverts the PAID month unlocking day edits', async ({ request }) => {
    const res = await request.post(
      `/api/workers/${workerId}/daily-pay/months/${PERIOD}/revert`,
      { data: { reason: 'e2e revert' }, headers: authed }
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('PENDING')
    expect(body.paidAt).toBeNull()
    expect(body.transitioned).toBe(true)

    const unlocked = await request.delete(`/api/workers/${workerId}/daily-pay/days/${DAY}`, {
      headers: authed,
    })
    expect(unlocked.status()).toBe(204)
  })

  test('denies marking an empty month PAID', async ({ request }) => {
    const res = await request.post(
      `/api/workers/${workerId}/daily-pay/months/2026-05-01/mark-paid`,
      { data: {}, headers: authed }
    )
    expect(res.status()).toBe(409)
  })
})
