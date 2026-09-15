import { Prisma } from '@prisma/client'
import type { DailyPayHistoryMonthDTO } from '@/types/daily-pay'

/**
 * Money, civil-date, and accrual helpers for worker daily-pay tracking.
 * Money values are canonical two-decimal strings computed with Prisma.Decimal
 * arithmetic, so summaries never inherit IEEE-754 binary-float drift. Civil
 * dates are strict "YYYY-MM-DD" strings handled entirely in UTC. Accrual is
 * informational and derived only from immutable rate snapshots.
 */

export type Money = string
export type CivilDate = string

/** Thrown when a value cannot be represented as exact money. */
export class DailyPayMoneyError extends Error {
  constructor(message = 'Invalid money value') {
    super(message)
    this.name = 'DailyPayMoneyError'
  }
}

/** Thrown when a daily rate is missing or is not strictly positive. */
export class DailyPayRateError extends Error {
  constructor(message = 'A positive daily rate is required') {
    super(message)
    this.name = 'DailyPayRateError'
  }
}

/** Thrown when a value is not a valid YYYY-MM-DD civil date. */
export class DailyPayDateError extends Error {
  constructor(message = 'Invalid civil date, expected YYYY-MM-DD') {
    super(message)
    this.name = 'DailyPayDateError'
  }
}

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 86_400_000

function parseDecimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  let parsed: Prisma.Decimal
  try {
    parsed = new Prisma.Decimal(value)
  } catch {
    throw new DailyPayMoneyError(`Cannot represent ${String(value)} as money`)
  }
  if (!parsed.isFinite()) throw new DailyPayMoneyError(`Cannot represent ${String(value)} as money`)
  return parsed
}

/** Canonical two-decimal representation of any exact money input. */
export function toMoney(value: string | number | Prisma.Decimal): Money {
  return parseDecimal(value).toFixed(2)
}

/** Sums exact money values into a canonical two-decimal total. */
export function sumMoney(values: readonly Money[]): Money {
  let total = new Prisma.Decimal(0)
  for (const value of values) total = total.plus(parseDecimal(value))
  return total.toFixed(2)
}

/**
 * Validates a configurable daily rate: finite and strictly positive. Returns
 * the canonical two-decimal string stored on the worker.
 */
export function parseDailyRate(value: string | number | Prisma.Decimal): Money {
  const parsed = parseDecimal(value)
  if (parsed.lessThanOrEqualTo(0)) throw new DailyPayRateError('Daily rate must be positive')
  return parsed.toFixed(2)
}

/**
 * Snapshots the rate in effect when a day is marked. A missing rate denies
 * accrual; a present rate is canonicalized once and never recalculated later.
 */
export function snapshotRate(rate: Money | null | undefined): Money {
  if (rate === null || rate === undefined) {
    throw new DailyPayRateError('A daily rate must be configured before marking worked days')
  }
  return parseDecimal(rate).toFixed(2)
}

/**
 * Exact accrued-only summary: the sum of the included rate snapshots. There
 * is no paid or balance component — accrual never mixes with payment
 * accounting.
 */
export function accruedTotals(snapshots: readonly Money[]): { accrued: Money } {
  return { accrued: sumMoney(snapshots) }
}

/** Formats a timestamp as a UTC civil date, never from local time. */
export function formatCivilDate(date: Date): CivilDate {
  const month = pad2(date.getUTCMonth() + 1)
  const day = pad2(date.getUTCDate())
  return `${date.getUTCFullYear()}-${month}-${day}`
}

function pad2(part: number): string {
  return String(part).padStart(2, '0')
}

/**
 * Parses a strict YYYY-MM-DD civil date at UTC midnight. Round-trip
 * verification rejects impossible calendar dates instead of rolling over.
 */
export function parseCivilDate(value: CivilDate): Date {
  if (!CIVIL_DATE_PATTERN.test(value)) {
    throw new DailyPayDateError(`Not a YYYY-MM-DD date: ${value}`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (formatCivilDate(date) !== value) {
    throw new DailyPayDateError(`Not a real calendar date: ${value}`)
  }
  return date
}

/**
 * Monday-to-Sunday week containing the date, computed with UTC arithmetic so
 * the result never depends on locale or DST. Sunday closes the week.
 */
export function weekRange(date: Date): { start: Date; end: Date } {
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  const start = new Date(date.getTime() - daysSinceMonday * MS_PER_DAY)
  const end = new Date(start.getTime() + 6 * MS_PER_DAY)
  return { start, end }
}

/** Civil-string week range for the Monday-Sunday calendar rendering. */
export function civilWeekRange(value: CivilDate): { start: CivilDate; end: CivilDate } {
  const { start, end } = weekRange(parseCivilDate(value))
  return { start: formatCivilDate(start), end: formatCivilDate(end) }
}

/** Months in a calendar year; annual history is always twelve entries. */
const MONTHS_PER_YEAR = 12

/**
 * Builds the annual history for a year: exactly twelve ordered calendar
 * months. Provided months slot into their calendar month; every absent month
 * is synthesized as PENDING with no timestamp and zero accrual — without any
 * write. Provided entries must be first-of-month period starts of that year.
 */
export function annualHistoryMonths(
  year: number,
  present: ReadonlyArray<DailyPayHistoryMonthDTO>
): DailyPayHistoryMonthDTO[] {
  const byPeriodStart = new Map<string, DailyPayHistoryMonthDTO>()
  for (const entry of present) {
    if (!entry.periodStart.endsWith('-01')) {
      throw new DailyPayDateError(
        `History months are keyed by first-of-month period starts, got ${entry.periodStart}`
      )
    }
    if (parseCivilDate(entry.periodStart).getUTCFullYear() !== year) {
      throw new DailyPayDateError(`History month ${entry.periodStart} does not belong to ${year}`)
    }
    byPeriodStart.set(entry.periodStart, entry)
  }
  return Array.from({ length: MONTHS_PER_YEAR }, (_, index) => {
    const periodStart = `${year}-${pad2(index + 1)}-01`
    return byPeriodStart.get(periodStart) ?? {
      periodStart,
      status: 'PENDING',
      paidAt: null,
      accrued: '0.00',
    }
  })
}
