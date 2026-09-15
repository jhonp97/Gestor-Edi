import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'

/**
 * Route-adapter tests for the worker daily-pay HTTP surface. The repository
 * and service are replaced by doubles: the routes must delegate every rule to
 * them (no business logic in handlers), so the assertions here pin the HTTP
 * contract only — auth, tenant scope, validation, awaited params, status
 * mapping, and non-disclosure.
 */

const repoState = vi.hoisted(() => ({
  findWorker: vi.fn(),
  setDailyRate: vi.fn(),
  listDays: vi.fn(),
  aggregateWorkedDays: vi.fn(),
  findMonth: vi.fn(),
  acquireMonthControl: vi.fn(),
  createDay: vi.fn(),
  deleteDay: vi.fn(),
  runSerializable: vi.fn(),
}))

const serviceState = vi.hoisted(() => ({
  markPaid: vi.fn(),
  revert: vi.fn(),
}))

vi.mock('@/lib/auth-edge', () => ({ getUserFromRequest: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { __testAdapter: true } }))
// The factories return function implementations because the routes invoke
// both classes with `new` (Vitest rejects arrow-function mocks there).
vi.mock('@/repositories/daily-pay.repository', () => ({
  DailyPayRepository: vi.fn(function DailyPayRepositoryMock() {
    return repoState
  }),
}))
vi.mock('@/services/daily-pay.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/daily-pay.service')>()
  return {
    ...actual,
    DailyPayService: vi.fn(function DailyPayServiceMock() {
      return serviceState
    }),
  }
})

import { getUserFromRequest } from '@/lib/auth-edge'
import { DailyPayRepository } from '@/repositories/daily-pay.repository'
import {
  DailyPayService,
  DailyPayEmptyMonthError,
  DailyPayMonthNotFoundError,
  DailyPayTransitionConflictError,
} from '@/services/daily-pay.service'
import { GET as getMonth, PATCH as patchMonth } from '@/app/api/workers/[id]/daily-pay/route'
import { GET as getHistory } from '@/app/api/workers/[id]/daily-pay/history/route'
import { PUT as putDay, DELETE as deleteDay } from '@/app/api/workers/[id]/daily-pay/days/[date]/route'
import { POST as markPaidRoute } from '@/app/api/workers/[id]/daily-pay/months/[periodStart]/mark-paid/route'
import { POST as revertRoute } from '@/app/api/workers/[id]/daily-pay/months/[periodStart]/revert/route'

const BASE = 'http://localhost:3000/api/workers'
const ORG_A = 'org-a'
const ORG_B = 'org-b'
const WORKER_ID = 'worker-1'
const PERIOD = '2026-03-01'
const DATE = '2026-03-15'
const USER_ID = 'user-1'
const PAID_AT = new Date('2026-03-15T10:30:00.000Z')
const PAID_AT_ISO = PAID_AT.toISOString()
const TX = { __txMarker: true } as unknown as Prisma.TransactionClient

type Actor = { userId: string; email: string; role: 'USER' | 'PLATFORM_ADMIN'; organizationId?: string }

const MEMBER: Actor = { userId: USER_ID, email: 'u@a.test', role: 'USER', organizationId: ORG_A }

function makeWorker(dailyRate: Prisma.Decimal | null = new Prisma.Decimal('120.00')) {
  return { id: WORKER_ID, organizationId: ORG_A, dailyRate }
}

function makeControl(overrides: Partial<{ status: 'PENDING' | 'PAID'; paidAt: Date | null }> = {}) {
  return {
    id: 'control-1',
    organizationId: ORG_A,
    workerId: WORKER_ID,
    periodStart: new Date(PERIOD),
    status: 'PENDING' as const,
    paidAt: null,
    ...overrides,
  }
}

function makeDay(date: string, rate: string) {
  return { workDate: new Date(`${date}T00:00:00.000Z`), rateSnapshot: new Prisma.Decimal(rate) }
}

function request(url: string, method = 'GET', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** Next.js route context: params arrive as a Promise and MUST be awaited. */
function ctx<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) }
}

const monthUrl = `${BASE}/${WORKER_ID}/daily-pay?periodStart=${PERIOD}`
const historyUrl = `${BASE}/${WORKER_ID}/daily-pay/history?year=2026`
const dayUrl = `${BASE}/${WORKER_ID}/daily-pay/days/${DATE}`
const markUrl = `${BASE}/${WORKER_ID}/daily-pay/months/${PERIOD}/mark-paid`
const revertUrl = `${BASE}/${WORKER_ID}/daily-pay/months/${PERIOD}/revert`

/** Every handler of the surface, ready to invoke with the default fixtures. */
const handlers: Array<[string, () => Promise<Response>]> = [
  ['GET month', () => getMonth(request(monthUrl), ctx({ id: WORKER_ID }))],
  ['PATCH month', () => patchMonth(request(monthUrl, 'PATCH', { dailyRate: '120.00' }), ctx({ id: WORKER_ID }))],
  ['GET history', () => getHistory(request(historyUrl), ctx({ id: WORKER_ID }))],
  ['PUT day', () => putDay(request(dayUrl, 'PUT'), ctx({ id: WORKER_ID, date: DATE }))],
  ['DELETE day', () => deleteDay(request(dayUrl, 'DELETE'), ctx({ id: WORKER_ID, date: DATE }))],
  ['POST mark-paid', () => markPaidRoute(request(markUrl, 'POST', {}), ctx({ id: WORKER_ID, periodStart: PERIOD }))],
  ['POST revert', () => revertRoute(request(revertUrl, 'POST', {}), ctx({ id: WORKER_ID, periodStart: PERIOD }))],
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getUserFromRequest).mockResolvedValue(MEMBER as never)
  repoState.findWorker.mockResolvedValue(makeWorker())
  repoState.setDailyRate.mockResolvedValue(makeWorker())
  repoState.listDays.mockResolvedValue([])
  repoState.aggregateWorkedDays.mockResolvedValue({ count: 0, accrued: '0.00' })
  repoState.findMonth.mockResolvedValue(makeControl())
  repoState.acquireMonthControl.mockResolvedValue(makeControl())
  repoState.createDay.mockResolvedValue({ id: 'day-1' })
  repoState.deleteDay.mockResolvedValue(1)
  repoState.runSerializable.mockImplementation(
    async (work: (tx: Prisma.TransactionClient) => unknown) => work(TX)
  )
  serviceState.markPaid.mockResolvedValue({ status: 'PAID', paidAt: PAID_AT_ISO, transitioned: true })
  serviceState.revert.mockResolvedValue({ status: 'PENDING', paidAt: null, transitioned: true })
})

describe('worker daily-pay API routes — authentication', () => {
  it.each(handlers)('%s answers 401 without an authenticated user', async (_name, call) => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null)
    const res = await call()
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(DailyPayRepository).not.toHaveBeenCalled()
    expect(DailyPayService).not.toHaveBeenCalled()
  })

  it.each(handlers)('%s answers 401 for a user without an organization', async (_name, call) => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ ...MEMBER, organizationId: undefined } as never)
    const res = await call()
    expect(res.status).toBe(401)
    expect(DailyPayRepository).not.toHaveBeenCalled()
  })
})

describe('worker daily-pay API routes — validation', () => {
  const invalidCases: Array<[string, () => Promise<Response>]> = [
    ['GET month without periodStart', () => getMonth(request(`${BASE}/${WORKER_ID}/daily-pay`), ctx({ id: WORKER_ID }))],
    ['GET month with a non month-start period', () => getMonth(request(`${BASE}/${WORKER_ID}/daily-pay?periodStart=2026-03-15`), ctx({ id: WORKER_ID }))],
    ['GET month with a non-date period', () => getMonth(request(`${BASE}/${WORKER_ID}/daily-pay?periodStart=not-a-date`), ctx({ id: WORKER_ID }))],
    ['GET history without year', () => getHistory(request(`${BASE}/${WORKER_ID}/daily-pay/history`), ctx({ id: WORKER_ID }))],
    ['GET history with a non-numeric year', () => getHistory(request(`${BASE}/${WORKER_ID}/daily-pay/history?year=20x6`), ctx({ id: WORKER_ID }))],
    ['PATCH month with a zero rate', () => patchMonth(request(monthUrl, 'PATCH', { dailyRate: '0.00' }), ctx({ id: WORKER_ID }))],
    ['PATCH month with a negative rate', () => patchMonth(request(monthUrl, 'PATCH', { dailyRate: '-1.00' }), ctx({ id: WORKER_ID }))],
    ['PATCH month with a non-decimal rate', () => patchMonth(request(monthUrl, 'PATCH', { dailyRate: 'abc' }), ctx({ id: WORKER_ID }))],
    ['PATCH month with unknown fields', () => patchMonth(request(monthUrl, 'PATCH', { dailyRate: '1.00', extra: 1 }), ctx({ id: WORKER_ID }))],
    ['PATCH month with malformed JSON', () => patchMonth(new Request(monthUrl, { method: 'PATCH', body: '{oops', headers: { 'content-type': 'application/json' } }), ctx({ id: WORKER_ID }))],
    ['PUT day with an impossible calendar date', () => putDay(request(`${BASE}/${WORKER_ID}/daily-pay/days/2023-02-29`, 'PUT'), ctx({ id: WORKER_ID, date: '2023-02-29' }))],
    ['PUT day with a non civil date', () => putDay(request(`${BASE}/${WORKER_ID}/daily-pay/days/15-03-2026`, 'PUT'), ctx({ id: WORKER_ID, date: '15-03-2026' }))],
    ['POST mark-paid with extra fields', () => markPaidRoute(request(markUrl, 'POST', { reason: 'x' }), ctx({ id: WORKER_ID, periodStart: PERIOD }))],
    ['POST revert with an empty reason', () => revertRoute(request(revertUrl, 'POST', { reason: '' }), ctx({ id: WORKER_ID, periodStart: PERIOD }))],
  ]

  it.each(invalidCases)('%s answers 400 without touching the data layer', async (_name, call) => {
    const res = await call()
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(typeof body.error).toBe('string')
    expect(body.error.length).toBeGreaterThan(0)
    expect(DailyPayRepository).not.toHaveBeenCalled()
    expect(DailyPayService).not.toHaveBeenCalled()
  })
})

describe('worker daily-pay API routes — tenant scope and awaited params', () => {
  it('GET month resolves the awaited worker id and binds the tenant', async () => {
    repoState.findWorker.mockResolvedValue(null)
    const res = await getMonth(request(monthUrl), ctx({ id: WORKER_ID }))
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'Worker not found' })
    expect(DailyPayRepository).toHaveBeenCalledWith(ORG_A)
    expect(repoState.findWorker).toHaveBeenCalledWith(WORKER_ID)
  })

  it('PLATFORM_ADMIN gets no cross-tenant bypass', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({
      ...MEMBER,
      role: 'PLATFORM_ADMIN',
      organizationId: ORG_B,
    } as never)
    repoState.findWorker.mockResolvedValue(null)
    const res = await getMonth(request(monthUrl), ctx({ id: WORKER_ID }))
    expect(res.status).toBe(404)
    expect(DailyPayRepository).toHaveBeenCalledWith(ORG_B)
    expect(repoState.findWorker).toHaveBeenCalledWith(WORKER_ID)
  })

  it('PUT day awaits the date param before validation', async () => {
    repoState.findWorker.mockResolvedValue(null)
    const res = await putDay(request(dayUrl, 'PUT'), ctx({ id: WORKER_ID, date: DATE }))
    expect(res.status).toBe(404)
    expect(repoState.findWorker).toHaveBeenCalledWith(WORKER_ID)
  })

  it('POST mark-paid maps a foreign or missing month to 404 without leakage', async () => {
    serviceState.markPaid.mockRejectedValue(new DailyPayMonthNotFoundError())
    const res = await markPaidRoute(request(markUrl, 'POST', {}), ctx({ id: WORKER_ID, periodStart: PERIOD }))
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'Daily-pay month not found' })
    expect(DailyPayService).toHaveBeenCalledWith(ORG_A)
    expect(serviceState.markPaid).toHaveBeenCalledWith(WORKER_ID, PERIOD, { userId: USER_ID })
  })

  it('POST revert maps a foreign or missing month to 404', async () => {
    serviceState.revert.mockRejectedValue(new DailyPayMonthNotFoundError())
    const res = await revertRoute(request(revertUrl, 'POST', {}), ctx({ id: WORKER_ID, periodStart: PERIOD }))
    expect(res.status).toBe(404)
    expect(serviceState.revert).toHaveBeenCalledWith(WORKER_ID, PERIOD, { userId: USER_ID }, {})
  })
})

describe('GET month — accrued-only MonthDTO', () => {
  it('returns the exact MonthDTO shape for a PAID month with worked days', async () => {
    repoState.listDays.mockResolvedValue([
      makeDay('2026-03-04', '100.25'),
      makeDay('2026-03-11', '100.25'),
      makeDay('2026-03-18', '100.25'),
    ])
    repoState.findMonth.mockResolvedValue(makeControl({ status: 'PAID', paidAt: PAID_AT }))
    const res = await getMonth(request(monthUrl), ctx({ id: WORKER_ID }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      workerId: WORKER_ID,
      periodStart: PERIOD,
      dailyRate: '120.00',
      status: 'PAID',
      paidAt: PAID_AT_ISO,
      days: [
        { date: '2026-03-04', rateSnapshot: '100.25' },
        { date: '2026-03-11', rateSnapshot: '100.25' },
        { date: '2026-03-18', rateSnapshot: '100.25' },
      ],
      totals: { accrued: '300.75' },
    })
    expect(repoState.listDays).toHaveBeenCalledWith(WORKER_ID, PERIOD, '2026-03-31', TX)
  })

  it('synthesizes a PENDING month without a control row and exposes accrued only', async () => {
    repoState.findMonth.mockResolvedValue(null)
    const res = await getMonth(request(monthUrl), ctx({ id: WORKER_ID }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; paidAt: string | null; totals: Record<string, string> }
    expect(body.status).toBe('PENDING')
    expect(body.paidAt).toBeNull()
    expect(Object.keys(body.totals)).toEqual(['accrued'])
  })
})

describe('PATCH month — daily rate', () => {
  it('sets a positive rate and returns the updated MonthDTO', async () => {
    repoState.setDailyRate.mockResolvedValue(makeWorker(new Prisma.Decimal('135.50')))
    const res = await patchMonth(request(monthUrl, 'PATCH', { dailyRate: '135.50' }), ctx({ id: WORKER_ID }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { dailyRate: string | null }
    expect(body.dailyRate).toBe('135.50')
    expect(repoState.setDailyRate).toHaveBeenCalledWith(WORKER_ID, '135.50')
  })

  it('clears the rate with null and reports it as null', async () => {
    repoState.setDailyRate.mockResolvedValue(makeWorker(null))
    const res = await patchMonth(request(monthUrl, 'PATCH', { dailyRate: null }), ctx({ id: WORKER_ID }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { dailyRate: string | null }
    expect(body.dailyRate).toBeNull()
    expect(repoState.setDailyRate).toHaveBeenCalledWith(WORKER_ID, null)
  })

  it('answers 404 for a foreign or missing worker', async () => {
    repoState.setDailyRate.mockResolvedValue(null)
    const res = await patchMonth(request(monthUrl, 'PATCH', { dailyRate: '120.00' }), ctx({ id: WORKER_ID }))
    expect(res.status).toBe(404)
  })
})

describe('PUT day — snapshotting worked days', () => {
  it('creates 201 with the snapshot of the current configured rate', async () => {
    const res = await putDay(request(dayUrl, 'PUT'), ctx({ id: WORKER_ID, date: DATE }))
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ date: DATE, rateSnapshot: '120.00' })
    expect(repoState.acquireMonthControl).toHaveBeenCalledWith(WORKER_ID, PERIOD, TX)
    expect(repoState.createDay).toHaveBeenCalledWith(WORKER_ID, DATE, '120.00', TX)
  })

  it('denies marking without a configured rate and writes nothing', async () => {
    repoState.findWorker.mockResolvedValue(makeWorker(null))
    const res = await putDay(request(dayUrl, 'PUT'), ctx({ id: WORKER_ID, date: DATE }))
    expect(res.status).toBe(409)
    expect(repoState.runSerializable).not.toHaveBeenCalled()
    expect(repoState.createDay).not.toHaveBeenCalled()
  })

  it('conflicts 409 when the month is PAID (day edits are locked)', async () => {
    repoState.acquireMonthControl.mockResolvedValue(makeControl({ status: 'PAID', paidAt: PAID_AT }))
    const res = await putDay(request(dayUrl, 'PUT'), ctx({ id: WORKER_ID, date: DATE }))
    expect(res.status).toBe(409)
    expect(repoState.createDay).not.toHaveBeenCalled()
  })

  it('conflicts 409 on a duplicate worked date', async () => {
    repoState.createDay.mockRejectedValue({ code: 'P2002' })
    const res = await putDay(request(dayUrl, 'PUT'), ctx({ id: WORKER_ID, date: DATE }))
    expect(res.status).toBe(409)
  })
})

describe('DELETE day — unmarking worked days', () => {
  it('removes the day and answers 204 with an empty body', async () => {
    const res = await deleteDay(request(dayUrl, 'DELETE'), ctx({ id: WORKER_ID, date: DATE }))
    expect(res.status).toBe(204)
    await expect(res.text()).resolves.toBe('')
    expect(repoState.deleteDay).toHaveBeenCalledWith(WORKER_ID, DATE, TX)
  })

  it('answers 404 when the civil date was never marked', async () => {
    repoState.deleteDay.mockResolvedValue(0)
    const res = await deleteDay(request(dayUrl, 'DELETE'), ctx({ id: WORKER_ID, date: DATE }))
    expect(res.status).toBe(404)
  })

  it('conflicts 409 when the month is PAID', async () => {
    repoState.acquireMonthControl.mockResolvedValue(makeControl({ status: 'PAID', paidAt: PAID_AT }))
    const res = await deleteDay(request(dayUrl, 'DELETE'), ctx({ id: WORKER_ID, date: DATE }))
    expect(res.status).toBe(409)
    expect(repoState.deleteDay).not.toHaveBeenCalled()
  })
})

describe('GET history — annual accrued-only history', () => {
  it('returns twelve ordered months and synthesizes absent ones as PENDING/0.00', async () => {
    repoState.findMonth.mockImplementation((_workerId: string, periodStart: string) =>
      Promise.resolve(periodStart === '2026-02-01' ? makeControl({ status: 'PAID', paidAt: PAID_AT }) : null)
    )
    repoState.aggregateWorkedDays.mockImplementation((_workerId: string, from: string) =>
      Promise.resolve({ count: from === '2026-02-01' ? 1 : 0, accrued: from === '2026-02-01' ? '150.25' : '0.00' })
    )
    const res = await getHistory(request(historyUrl), ctx({ id: WORKER_ID }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { year: number; months: Array<{ periodStart: string; status: string; paidAt: string | null; accrued: string }> }
    expect(body.year).toBe(2026)
    expect(body.months).toHaveLength(12)
    expect(body.months[1]).toEqual({ periodStart: '2026-02-01', status: 'PAID', paidAt: PAID_AT_ISO, accrued: '150.25' })
    expect(body.months[0]).toEqual({ periodStart: '2026-01-01', status: 'PENDING', paidAt: null, accrued: '0.00' })
    expect(body.months.map((m) => m.periodStart)[11]).toBe('2026-12-01')
  })

  it('answers 404 for a foreign or missing worker', async () => {
    repoState.findWorker.mockResolvedValue(null)
    const res = await getHistory(request(historyUrl), ctx({ id: WORKER_ID }))
    expect(res.status).toBe(404)
  })
})

describe('POST month transitions', () => {
  it('mark-paid returns 200 with the transition result for an eligible month', async () => {
    const res = await markPaidRoute(request(markUrl, 'POST', {}), ctx({ id: WORKER_ID, periodStart: PERIOD }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'PAID', paidAt: PAID_AT_ISO, transitioned: true })
  })

  it('repeated same-state mark-paid stays a 200 no-op', async () => {
    serviceState.markPaid.mockResolvedValue({ status: 'PAID', paidAt: PAID_AT_ISO, transitioned: false })
    const res = await markPaidRoute(request(markUrl, 'POST', {}), ctx({ id: WORKER_ID, periodStart: PERIOD }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { transitioned: boolean }
    expect(body.transitioned).toBe(false)
  })

  it('mark-paid maps the empty-month guard to 409', async () => {
    serviceState.markPaid.mockRejectedValue(new DailyPayEmptyMonthError())
    const res = await markPaidRoute(request(markUrl, 'POST', {}), ctx({ id: WORKER_ID, periodStart: PERIOD }))
    expect(res.status).toBe(409)
    expect(repoState.createDay).not.toHaveBeenCalled()
  })

  it('mark-paid maps exhausted serialization retries to 409', async () => {
    serviceState.markPaid.mockRejectedValue(new DailyPayTransitionConflictError())
    const res = await markPaidRoute(request(markUrl, 'POST', {}), ctx({ id: WORKER_ID, periodStart: PERIOD }))
    expect(res.status).toBe(409)
  })

  it('revert forwards the optional reason and returns 200', async () => {
    const res = await revertRoute(request(revertUrl, 'POST', { reason: 'wrong month' }), ctx({ id: WORKER_ID, periodStart: PERIOD }))
    expect(res.status).toBe(200)
    expect(serviceState.revert).toHaveBeenCalledWith(WORKER_ID, PERIOD, { userId: USER_ID }, { reason: 'wrong month' })
  })

  it('reverting a PENDING month stays a 200 unaudited no-op', async () => {
    serviceState.revert.mockResolvedValue({ status: 'PENDING', paidAt: null, transitioned: false })
    const res = await revertRoute(request(revertUrl, 'POST', {}), ctx({ id: WORKER_ID, periodStart: PERIOD }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { transitioned: boolean }
    expect(body.transitioned).toBe(false)
  })
})

describe('non-disclosure and structural guards', () => {
  it('unexpected failures answer a sanitized 500 without leaking internals', async () => {
    repoState.findWorker.mockRejectedValue(new Error('P1001 raw connection string postgres://secret'))
    const res = await getMonth(request(monthUrl), ctx({ id: WORKER_ID }))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Internal server error')
    expect(JSON.stringify(body)).not.toContain('P1001')
    expect(JSON.stringify(body)).not.toContain('postgres://')
  })

  it('unexpected transition failures answer a sanitized 500', async () => {
    serviceState.markPaid.mockRejectedValue(new Error('P2028 transaction API unexpected'))
    const res = await markPaidRoute(request(markUrl, 'POST', {}), ctx({ id: WORKER_ID, periodStart: PERIOD }))
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'Internal server error' })
  })

  it('never exposes a payments endpoint', () => {
    const paymentsRoute = path.join(process.cwd(), 'src', 'app', 'api', 'workers', '[id]', 'daily-pay', 'payments', 'route.ts')
    expect(existsSync(paymentsRoute)).toBe(false)
  })
})
