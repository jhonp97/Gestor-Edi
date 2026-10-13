import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  worker: { findFirst: vi.fn(), findMany: vi.fn() },
  payroll: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/auth-edge', () => ({ getUserFromRequest: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { getUserFromRequest } from '@/lib/auth-edge'
import { POST as individual } from '@/app/api/payroll/individual/route'
import { POST as bulk } from '@/app/api/payroll/generate/route'

const input = { workerId: 'worker', month: 3, year: 2026, baseSalary: 1000, bonusAmount: 100, irpfPercent: 10 }
const request = (body: object) => new Request('http://localhost/api/payroll', { method: 'POST', body: JSON.stringify(body) })
const paid = (start: string | null, end: string | null, month = 3) => ({ id: 'paid', workerId: 'worker', organizationId: 'org', month, year: 2026, periodStart: start && new Date(start), periodEnd: end && new Date(end), paidAt: new Date() })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getUserFromRequest).mockResolvedValue({ organizationId: 'org' } as never)
  db.worker.findFirst.mockResolvedValue({ id: 'worker', organizationId: 'org' })
  db.worker.findMany.mockResolvedValue([{ id: 'worker', name: 'Ana', baseSalary: 1000 }])
  db.payroll.findFirst.mockResolvedValue(null)
  db.payroll.findMany.mockResolvedValue([])
  db.payroll.create.mockImplementation(async ({ data }) => ({ id: 'new', ...data }))
  db.$transaction.mockImplementation(async (run) => run(db))
  db.$queryRaw.mockResolvedValue([{ id: 'worker' }])
})

describe('payroll generation public boundaries', () => {
  it.each([
    { periodStart: '2026-02-30', periodEnd: '2026-03-02' },
    { periodStart: '2026-03-15' },
    { periodEnd: '2026-03-15' },
    { periodStart: '2026-03-20', periodEnd: '2026-03-15' },
    { periodStart: '2026-3-01', periodEnd: '2026-03-15' },
    { periodStart: null, periodEnd: null },
    { month: 13 },
  ])('rejects invalid period without writes: %j', async (override) => {
    const response = await individual(request({ ...input, ...override }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.any(String) })
    expect(db.payroll.create).not.toHaveBeenCalled()
  })

  it('persists inclusive explicit dates and attributes month/year to start; manual salary remains unchanged', async () => {
    const response = await individual(request({ ...input, periodStart: '2025-12-15', periodEnd: '2026-01-14' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ month: 12, year: 2025, periodStart: '2025-12-15T00:00:00.000Z', periodEnd: '2026-01-14T00:00:00.000Z', baseSalary: 1000, grossPay: 1100, irpfAmount: 100, netPay: 1000 })
  })

  it('preserves calendar defaults and prior salary/percentage behavior', async () => {
    const response = await individual(request(input))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ month: 3, year: 2026, baseSalary: 1000, netPay: 1000 })
    const invalid = await individual(request({ ...input, irpfPercent: 101 }))
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: expect.any(String) })
    expect(db.payroll.create).toHaveBeenCalledTimes(1)
  })

  it('allows an overlapping pending document without deleting it', async () => {
    db.payroll.findFirst.mockResolvedValue({ ...paid(null, null), paidAt: null })
    const response = await individual(request(input))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: 'new' })
  })

  it.each([paid(null, null), paid('2026-02-15', '2026-03-15', 2)])('rejects paid overlap including legacy months without writes', async (existing) => {
    db.payroll.findMany.mockResolvedValue([existing])
    const response = await individual(request(input))
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: expect.any(String) })
    expect(db.payroll.create).not.toHaveBeenCalled()
  })

  it('allows adjacent non-overlapping paid periods', async () => {
    db.payroll.findMany.mockResolvedValue([paid('2026-02-01', '2026-02-28', 2)])
    const response = await individual(request(input))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: 'new' })
  })

  it('bulk regeneration allows pending documents and preserves monthly calculation', async () => {
    db.payroll.findFirst.mockResolvedValue({ ...paid(null, null), paidAt: null })
    const response = await bulk(request({ month: 3, year: 2026 }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ created: 1, skipped: 0, skippedNames: [] })
    expect(db.payroll.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ month: 3, year: 2026, grossPay: 1000, irpfAmount: 150, socialSecurityAmount: 63.5, netPay: 786.5 }) }))
  })

  it('bulk skips paid overlapping ranges even when attributed to another month', async () => {
    db.payroll.findMany.mockResolvedValue([paid('2026-02-15', '2026-03-15', 2)])
    const response = await bulk(request({ month: 3, year: 2026 }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ created: 0, skipped: 1, skippedNames: ['Ana'] })
    expect(db.payroll.create).not.toHaveBeenCalled()
  })

  it('keeps unauthenticated and foreign-worker requests read/write isolated', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null)
    const unauthorized = await individual(request(input))
    expect(unauthorized.status).toBe(401)
    expect(await unauthorized.json()).toEqual({ error: 'Unauthorized' })
    expect(db.worker.findFirst).not.toHaveBeenCalled()
    vi.mocked(getUserFromRequest).mockResolvedValue({ organizationId: 'org' } as never)
    db.worker.findFirst.mockResolvedValue(null)
    const missing = await individual(request(input))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Trabajador no encontrado' })
    expect(db.worker.findFirst).toHaveBeenCalledWith({ where: { id: 'worker', organizationId: 'org' } })
    expect(db.payroll.create).not.toHaveBeenCalled()
  })
})
