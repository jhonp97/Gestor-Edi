import { formatCivilDate, parseCivilDate, type CivilDate } from '@/lib/daily-pay'
import { AuditLogRepository } from '@/repositories/audit-log.repository'
import { DailyPayRepository } from '@/repositories/daily-pay.repository'

/**
 * Typed transition errors for the daily-pay month marker. Routes map them to
 * HTTP statuses: not found (missing or cross-tenant, no leakage) to 404, the
 * empty-month guard and the serialization-conflict mapping to 409.
 */
export class DailyPayMonthNotFoundError extends Error {
  constructor(message = 'Daily-pay month control not found for this organization') {
    super(message)
    this.name = 'DailyPayMonthNotFoundError'
  }
}

export class DailyPayEmptyMonthError extends Error {
  constructor(message = 'A month without worked days cannot be marked paid') {
    super(message)
    this.name = 'DailyPayEmptyMonthError'
  }
}

export class DailyPayTransitionConflictError extends Error {
  constructor(message = 'The month transition could not be serialized after the bounded retries') {
    super(message)
    this.name = 'DailyPayTransitionConflictError'
  }
}

/** Revert reasons are optional, sanitized, and bounded for safe log/storage. */
export const MAX_REVERT_REASON_LENGTH = 280

/** One audit action per target state; the transition verb lives in the details. */
const AUDIT_ACTION_BY_STATUS = {
  PAID: 'DAILY_PAY_MONTH_MARKED_PAID',
  PENDING: 'DAILY_PAY_MONTH_MARKED_PENDING',
} as const

export type DailyPayActor = { userId: string }

export type DailyPayRevertCommand = { reason?: string }

export type DailyPayTransitionResult = {
  status: 'PENDING' | 'PAID'
  paidAt: string | null
  transitioned: boolean
}

type DailyPayServiceDeps = {
  repository?: DailyPayRepository
  auditRepository?: AuditLogRepository
  now?: () => Date
}

/**
 * Collapses registry control characters and whitespace runs into single
 * spaces, trims, and bounds the length, so an optional revert reason is safe
 * for logs and JSON storage. A reason that sanitizes to empty is omitted.
 */
export function sanitizeRevertReason(reason: string): string | undefined {
  const cleaned = reason
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_REVERT_REASON_LENGTH)
    .trim()
  return cleaned.length > 0 ? cleaned : undefined
}

/** Last civil day of the month that starts on periodStart (UTC, no DST). */
export function monthEnd(periodStart: CivilDate): CivilDate {
  const start = parseCivilDate(periodStart)
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
  return formatCivilDate(end)
}

/**
 * True only for serialization failures (Prisma P2034 / SQLSTATE 40001) that
 * the repository's bounded Serializable retry rethrows after exhausting its
 * budget. The repository owns retrying — the service never retries itself;
 * it only classifies the final error for the conflict mapping. Every other
 * failure propagates untouched so audit failures abort the transition.
 */
function isSerializationFailure(error: unknown): boolean {
  const code = (error as { code?: string } | null | undefined)?.code
  if (code === 'P2034') return true
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('40001')
}

/**
 * Application service for the daily-pay monthly marker. Every command runs
 * the design flow — lock, state check, day-count guard, state write, audit
 * append — inside ONE Serializable transaction from the tenant repository:
 *
 * - marking PAID requires at least one worked day in the target month and
 *   stamps paidAt with the current time; reverting clears it and unlocks day
 *   edits; the PAID state itself is what locks day edits (repository flows
 *   conflict before writing on a PAID control);
 * - same-state commands are idempotent no-ops: the stored timestamp is
 *   returned untouched and no audit event is appended;
 * - the state write and the audit insert share the transaction client, so a
 *   failed audit rolls back the transition: neither survives;
 * - the transaction client is injected into the AuditLogRepository, whose
 *   details carry worker, period, transition verb, previous/new paidAt and
 *   the optional sanitized reason, while actor/tenant/time ride the columns;
 * - the tenant comes from the organizationId the service is built with (the
 *   same one its repository enforces), so cross-tenant ids and PLATFORM_ADMIN
 *   bypass attempts resolve as not found without any write or audit.
 */
export class DailyPayService {
  private readonly repository: DailyPayRepository
  private readonly auditRepository: AuditLogRepository
  private readonly now: () => Date

  constructor(
    private readonly organizationId: string,
    deps: DailyPayServiceDeps = {}
  ) {
    this.repository = deps.repository ?? new DailyPayRepository(organizationId)
    this.auditRepository = deps.auditRepository ?? new AuditLogRepository()
    this.now = deps.now ?? (() => new Date())
  }

  /** Marks an eligible month PAID: guard, stamp, lock, one audit event. */
  async markPaid(
    workerId: string,
    periodStart: CivilDate,
    actor: DailyPayActor
  ): Promise<DailyPayTransitionResult> {
    return this.transition(workerId, periodStart, actor, 'PAID')
  }

  /** Reverts a PAID month to PENDING: clears the stamp, unlocks, one audit event. */
  async revert(
    workerId: string,
    periodStart: CivilDate,
    actor: DailyPayActor,
    command?: DailyPayRevertCommand
  ): Promise<DailyPayTransitionResult> {
    const reason = command?.reason === undefined ? undefined : sanitizeRevertReason(command.reason)
    return this.transition(workerId, periodStart, actor, 'PENDING', reason)
  }

  private async transition(
    workerId: string,
    periodStart: CivilDate,
    actor: DailyPayActor,
    target: 'PENDING' | 'PAID',
    reason?: string
  ): Promise<DailyPayTransitionResult> {
    try {
      return await this.repository.runSerializable(async (tx) => {
        // Same-state fast path: a repeated command in the settled state must be
        // genuinely write-free (design: "same-state paths write nothing"), so it
        // is answered from the read-only, org-keyed lookup instead of the
        // lock-acquiring upsert — no mutex touch, no updatedAt churn, no audit.
        // The lookup is tenant-scoped, so a foreign worker still resolves as
        // null and falls through to the ownership proof below.
        const settled = await this.repository.findMonth(workerId, periodStart, tx)
        if (settled !== null && settled.status === target) {
          return {
            status: target,
            paidAt: settled.paidAt?.toISOString() ?? null,
            transitioned: false,
          }
        }

        // The control row is acquired (or created as PENDING) inside the
        // transition transaction: its touch write stays locked until commit,
        // serializing rival transitions and day edits. A worker outside this
        // organization resolves as null: not found, no leakage, no writes.
        const control = await this.repository.acquireMonthControl(workerId, periodStart, tx)
        if (control === null) throw new DailyPayMonthNotFoundError()

        // Same-state after acquisition (the row may have been created
        // concurrently between the lookup and the lock): nothing is written,
        // nothing is audited, and the stored timestamp is preserved exactly.
        if (control.status === target) {
          return { status: target, paidAt: control.paidAt?.toISOString() ?? null, transitioned: false }
        }

        if (target === 'PAID') {
          // Marking PAID requires at least one worked day in the target month;
          // the transaction rolls back the acquired control when denied.
          const count = await this.repository.countWorkedDays(
            workerId,
            periodStart,
            monthEnd(periodStart),
            tx
          )
          if (count < 1) throw new DailyPayEmptyMonthError()
        }

        const previousPaidAt = control.paidAt
        const paidAt = target === 'PAID' ? this.now() : null
        const updated = await this.repository.setMonthState(workerId, periodStart, target, paidAt, tx)

        // The audit append uses the SAME transaction client: if it fails, the
        // whole transition rolls back and neither state nor audit survives.
        await this.auditRepository.create(
          {
            action: AUDIT_ACTION_BY_STATUS[target],
            userId: actor.userId,
            organizationId: this.organizationId,
            details: {
              workerId,
              periodStart,
              transition: target === 'PAID' ? 'PENDING→PAID' : 'PAID→PENDING',
              previousPaidAt: previousPaidAt?.toISOString() ?? null,
              newPaidAt: updated.paidAt?.toISOString() ?? null,
              ...(reason !== undefined ? { reason } : {}),
            },
          },
          tx
        )

        return { status: target, paidAt: updated.paidAt?.toISOString() ?? null, transitioned: true }
      })
    } catch (error) {
      if (isSerializationFailure(error)) throw new DailyPayTransitionConflictError()
      throw error
    }
  }
}
