import {
  Prisma,
  type DailyPayDay,
  type DailyPayMonthControl,
  type PrismaClient,
  type Worker,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseCivilDate, toMoney, type CivilDate, type Money } from '@/lib/daily-pay'
import type { MonthStatus } from '@/types/daily-pay'

/** Bounded Serializable retry budget for month transitions and day edits. */
const MAX_TRANSACTION_ATTEMPTS = 3

/**
 * True only for serialization failures that are safe to retry: Prisma's
 * P2034 write-conflict/deadlock code and raw SQLSTATE 40001. Every other
 * error propagates on the first attempt.
 */
function isSerializationFailure(error: unknown): boolean {
  const code = (error as { code?: string } | null | undefined)?.code
  if (code === 'P2034') return true
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('40001')
}

/**
 * Required-tenant unit of work for worker daily-pay tracking.
 *
 * The constructor demands an organizationId and every query, aggregate and
 * mutation carries that organization predicate in the database query itself,
 * so no caller — including PLATFORM_ADMIN — can bypass tenancy: cross-tenant
 * ids resolve as not found. There are no payment methods and no payment
 * accounting: the only monthly truth is the PENDING|PAID marker with its
 * nullable paidAt stamp. Day, count and month-control operations are
 * transaction-scoped (they receive the caller's transaction client), so the
 * service composes them inside one Serializable transaction: it acquires the
 * control row, checks the state and the worked-day count, and stamps or
 * clears the marker together with paidAt; closure policy stays in the
 * service. Money is stored and summed as exact Prisma.Decimal values; civil
 * dates are parsed to UTC midnight. runSerializable executes work under
 * Serializable isolation and retries serialization failures up to
 * MAX_TRANSACTION_ATTEMPTS before propagating.
 */
export class DailyPayRepository {
  private readonly organizationId: string
  private readonly client: PrismaClient

  constructor(organizationId: string, client: PrismaClient = prisma) {
    if (!organizationId) {
      throw new Error('DailyPayRepository requires an organizationId')
    }
    this.organizationId = organizationId
    this.client = client
  }

  async findWorker(workerId: string): Promise<Worker | null> {
    return this.findWorkerIn(this.client, workerId)
  }

  async setDailyRate(workerId: string, dailyRate: Money | null): Promise<Worker | null> {
    const worker = await this.findWorker(workerId)
    if (!worker) return null
    return this.client.worker.update({
      where: { id: worker.id },
      data: { dailyRate: dailyRate === null ? null : new Prisma.Decimal(dailyRate) },
    })
  }

  /** Marks a worked day inside the caller's transaction after the in-tx scope check. */
  async createDay(
    workerId: string,
    workDate: CivilDate,
    rateSnapshot: Money,
    tx: Prisma.TransactionClient
  ): Promise<DailyPayDay | null> {
    const workDay = parseCivilDate(workDate)
    const worker = await this.findWorkerIn(tx, workerId)
    if (!worker) return null
    return tx.dailyPayDay.create({
      data: {
        workerId: worker.id,
        organizationId: this.organizationId,
        workDate: workDay,
        rateSnapshot: new Prisma.Decimal(rateSnapshot),
      },
    })
  }

  /** Unmarks worked days inside the caller's transaction; returns the removed count. */
  async deleteDay(workerId: string, workDate: CivilDate, tx: Prisma.TransactionClient): Promise<number> {
    const deleted = await tx.dailyPayDay.deleteMany({
      where: {
        workerId,
        organizationId: this.organizationId,
        workDate: parseCivilDate(workDate),
      },
    })
    return deleted.count
  }

  async listDays(
    workerId: string,
    from: CivilDate,
    to: CivilDate,
    tx: Prisma.TransactionClient
  ): Promise<DailyPayDay[]> {
    return tx.dailyPayDay.findMany({
      where: { workerId, organizationId: this.organizationId, workDate: this.civilRange(from, to) },
      orderBy: { workDate: 'asc' },
    })
  }

  async countWorkedDays(
    workerId: string,
    from: CivilDate,
    to: CivilDate,
    tx: Prisma.TransactionClient
  ): Promise<number> {
    return tx.dailyPayDay.count({
      where: { workerId, organizationId: this.organizationId, workDate: this.civilRange(from, to) },
    })
  }

  /** Exact accrued-only summary: count plus the exact snapshot sum, nothing else. */
  async aggregateWorkedDays(
    workerId: string,
    from: CivilDate,
    to: CivilDate,
    tx: Prisma.TransactionClient
  ): Promise<{ count: number; accrued: Money }> {
    const aggregate = await tx.dailyPayDay.aggregate({
      where: { workerId, organizationId: this.organizationId, workDate: this.civilRange(from, to) },
      _count: true,
      _sum: { rateSnapshot: true },
    })
    return { count: aggregate._count, accrued: toMoney(aggregate._sum.rateSnapshot ?? 0) }
  }

  async findMonth(
    workerId: string,
    periodStart: CivilDate,
    tx: Prisma.TransactionClient
  ): Promise<DailyPayMonthControl | null> {
    return tx.dailyPayMonthControl.findFirst({
      where: { organizationId: this.organizationId, workerId, periodStart: parseCivilDate(periodStart) },
    })
  }

  /**
   * Idempotent month-lock primitive: proves the worker belongs to this
   * organization inside the caller's transaction, then upserts the unique
   * tenant row as PENDING (paidAt stays null) and touches updatedAt so the
   * row stays locked until commit, serializing rival month transitions and
   * day edits for this organization and worker. Acquiring repeatedly never
   * changes status or paidAt; a worker outside the tenant resolves as null
   * and no control row is created.
   */
  async acquireMonthControl(
    workerId: string,
    periodStart: CivilDate,
    tx: Prisma.TransactionClient
  ): Promise<DailyPayMonthControl | null> {
    // The compound tenant key alone does not prove ownership and the worker FK
    // only checks existence, so the upsert is gated on an in-transaction scope
    // proof: the read joins the Serializable snapshot, so a concurrent worker
    // deletion or transfer aborts the transaction and the bounded retry
    // re-proves ownership before any control row is written.
    const worker = await this.findWorkerIn(tx, workerId)
    if (!worker) return null
    return tx.dailyPayMonthControl.upsert({
      where: { organizationId_workerId_periodStart: this.monthKey(workerId, periodStart) },
      create: { ...this.monthKey(workerId, periodStart), status: 'PENDING' },
      // The touch write keeps the row locked until commit, serializing rival
      // month transitions for this organization and worker.
      update: { updatedAt: new Date() },
    })
  }

  /**
   * Marker round trip: writes status and paidAt together so the database
   * CHECK always observes a valid pair. PAID stamps the timestamp, PENDING
   * clears it. Repeated same-state writes carry identical data.
   */
  async setMonthState(
    workerId: string,
    periodStart: CivilDate,
    status: MonthStatus,
    paidAt: Date | null,
    tx: Prisma.TransactionClient
  ): Promise<DailyPayMonthControl> {
    return tx.dailyPayMonthControl.update({
      where: { organizationId_workerId_periodStart: this.monthKey(workerId, periodStart) },
      data: { status, paidAt },
    })
  }

  /**
   * Runs work under Serializable isolation, retrying serialization failures
   * (P2034 / SQLSTATE 40001) up to the bounded budget. The work closure must
   * be re-runnable; failed attempts commit nothing.
   */
  async runSerializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    let lastError: unknown
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await this.client.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        })
      } catch (error) {
        lastError = error
        if (!isSerializationFailure(error)) throw error
      }
    }
    throw lastError
  }

  /** Scope check usable from both the bare client and the caller's transaction. */
  private findWorkerIn(client: PrismaClient | Prisma.TransactionClient, workerId: string) {
    return client.worker.findFirst({
      where: { id: workerId, organizationId: this.organizationId },
    })
  }

  /** UTC-midnight inclusive range shared by every civil-date query. */
  private civilRange(from: CivilDate, to: CivilDate) {
    return { gte: parseCivilDate(from), lte: parseCivilDate(to) }
  }

  /** Organization-scoped compound key; the org predicate is part of the key. */
  private monthKey(workerId: string, periodStart: CivilDate) {
    return {
      organizationId: this.organizationId,
      workerId,
      periodStart: parseCivilDate(periodStart),
    }
  }
}
