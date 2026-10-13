import { Prisma, type PrismaClient } from '@prisma/client'
import { formatCivilDate, parseCivilDate } from '@/lib/daily-pay'

export class PayrollPeriodError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message)
    this.name = 'PayrollPeriodError'
  }
}

export interface PayrollPeriod {
  periodStart: Date
  periodEnd: Date
  month: number
  year: number
}

/** Civil dates are inclusive and independent of the browser/server time zone. */
export function resolvePayrollPeriod(input: {
  month?: unknown; year?: unknown; periodStart?: unknown; periodEnd?: unknown
}): PayrollPeriod {
  let start: Date
  let end: Date
  if (input.periodStart !== undefined || input.periodEnd !== undefined) {
    if (typeof input.periodStart !== 'string' || typeof input.periodEnd !== 'string') {
      throw new PayrollPeriodError('Desde y hasta son requeridos juntos en formato YYYY-MM-DD')
    }
    try {
      start = parseCivilDate(input.periodStart)
      end = parseCivilDate(input.periodEnd)
    } catch {
      throw new PayrollPeriodError('Las fechas deben ser días válidos en formato YYYY-MM-DD')
    }
  } else {
    const { month, year } = input
    if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12 ||
        typeof year !== 'number' || !Number.isInteger(year) || year < 100 || year > 9999) {
      throw new PayrollPeriodError('Mes y año inválidos')
    }
    start = new Date(Date.UTC(year, month - 1, 1))
    end = new Date(Date.UTC(year, month, 0))
  }
  if (start > end) throw new PayrollPeriodError('Desde no puede ser posterior a hasta')
  return { periodStart: start, periodEnd: end, month: start.getUTCMonth() + 1, year: start.getUTCFullYear() }
}

export function storedPayrollPeriod(payroll: {
  month: number; year: number; periodStart?: Date | null; periodEnd?: Date | null
}): PayrollPeriod {
  return payroll.periodStart && payroll.periodEnd
    ? resolvePayrollPeriod({ periodStart: formatCivilDate(payroll.periodStart), periodEnd: formatCivilDate(payroll.periodEnd) })
    : resolvePayrollPeriod({ month: payroll.month, year: payroll.year })
}

export function periodsOverlap(a: PayrollPeriod, b: PayrollPeriod): boolean {
  return a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd
}

/** Lock the worker, not the document: two pending documents can share days. */
export async function withPayrollWorkerLock<T>(
  db: PrismaClient, organizationId: string, workerId: string,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    const workers = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Worker" WHERE "id" = ${workerId}
      AND "organizationId" = ${organizationId} FOR UPDATE
    `
    if (!workers.length) throw new PayrollPeriodError('Trabajador no encontrado', 404)
    return action(tx)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

export async function assertNoPaidOverlap(
  tx: Prisma.TransactionClient, organizationId: string, workerId: string,
  period: PayrollPeriod, excludeId?: string,
): Promise<void> {
  const paid = await tx.payroll.findMany({
    where: { organizationId, workerId, paidAt: { not: null }, ...(excludeId ? { id: { not: excludeId } } : {}) },
  })
  if (paid.some((payroll) => periodsOverlap(period, storedPayrollPeriod(payroll)))) {
    throw new PayrollPeriodError('El intervalo incluye días de una nómina ya pagada', 409)
  }
}

export async function payPayroll(
  db: PrismaClient, organizationId: string, id: string, paidAt = new Date(),
) {
  const existing = await db.payroll.findFirst({ where: { id, organizationId } })
  if (!existing) throw new PayrollPeriodError('Nómina no encontrada', 404)
  return withPayrollWorkerLock(db, organizationId, existing.workerId, async (tx) => {
    const payroll = await tx.payroll.findFirst({ where: { id, organizationId }, include: { worker: true } })
    if (!payroll) throw new PayrollPeriodError('Nómina no encontrada', 404)
    if (payroll.paidAt) return payroll
    await assertNoPaidOverlap(tx, organizationId, payroll.workerId, storedPayrollPeriod(payroll), id)
    return tx.payroll.update({ where: { id }, data: { paidAt }, include: { worker: true } })
  })
}

export function payrollErrorResponse(error: unknown, fallback: string): Response {
  if (error instanceof PayrollPeriodError) return Response.json({ error: error.message }, { status: error.status })
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
    return Response.json({ error: 'Conflicto al procesar la nómina; vuelve a intentarlo' }, { status: 409 })
  }
  return Response.json({ error: fallback }, { status: 500 })
}
