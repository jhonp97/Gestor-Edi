import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { parseCivilDate } from '@/lib/daily-pay'

/**
 * Zod command and query contracts for worker daily-pay accrual.
 *
 * Money crosses JSON only as strings: command inputs are plain decimal
 * strings (strictly positive where the spec requires it) and DTO outputs are
 * canonical two-decimal strings, so no Decimal object or floating-point money
 * ever crosses the boundary. Civil dates are strict YYYY-MM-DD strings
 * validated through the shared UTC calendar parser. Every command is strict:
 * unknown fields are rejected. The DTO exposes accrued value only — no
 * payment records, amounts paid, balances, or overpayment semantics exist.
 * paidAt is a nullable ISO-8601 UTC timestamp obeying the marker invariant:
 * PAID iff present.
 */

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CANONICAL_MONEY_PATTERN = /^-?\d+\.\d{2}$/
const DECIMAL_INPUT_PATTERN = /^\d+(\.\d+)?$/
const YEAR_PATTERN = /^\d{4}$/

const isCivilDate = (value: string): boolean => {
  try {
    parseCivilDate(value)
    return true
  } catch {
    return false
  }
}

const isPositiveMoney = (value: string): boolean => {
  try {
    return new Prisma.Decimal(value).greaterThan(0)
  } catch {
    return false
  }
}

export const civilDateSchema = z
  .string()
  .regex(CIVIL_DATE_PATTERN, 'Expected a YYYY-MM-DD civil date')
  .refine(isCivilDate, 'Not a real calendar date')

export const periodStartSchema = civilDateSchema.refine(
  (value) => value.endsWith('-01'),
  'Period start must be the first day of the month'
)

export const canonicalMoneySchema = z
  .string()
  .regex(CANONICAL_MONEY_PATTERN, 'Money must be a canonical two-decimal string')

export const positiveMoneyInputSchema = z
  .string()
  .regex(DECIMAL_INPUT_PATTERN, 'Daily rate must be a plain decimal string')
  .refine(isPositiveMoney, 'Daily rate must be strictly positive')

/** PAID months carry a paidAt stamp; PENDING months carry null. */
const hasMarkerState = (value: { status: 'PENDING' | 'PAID'; paidAt: string | null }): boolean =>
  value.status === 'PAID' ? value.paidAt !== null : value.paidAt === null

const MARKER_STATE_MESSAGE =
  'A PAID month requires paidAt and a PENDING month requires paidAt to be null'

/** Marker fields shared by the month DTO and the annual-history entries. */
const monthStatusField = z.enum(['PENDING', 'PAID'])
const paidAtField = z.iso.datetime().nullable()

const dailyPayDayDtoSchema = z
  .object({
    date: civilDateSchema,
    rateSnapshot: canonicalMoneySchema,
  })
  .strict()

const dailyPayTotalsDtoSchema = z
  .object({
    accrued: canonicalMoneySchema,
  })
  .strict()

export const dailyPayMonthSchema = z
  .object({
    workerId: z.uuid('Worker id must be a UUID'),
    periodStart: periodStartSchema,
    dailyRate: canonicalMoneySchema.nullable(),
    status: monthStatusField,
    paidAt: paidAtField,
    days: z.array(dailyPayDayDtoSchema),
    totals: dailyPayTotalsDtoSchema,
  })
  .strict()
  .refine(hasMarkerState, MARKER_STATE_MESSAGE)

const dailyPayHistoryMonthSchema = z
  .object({
    periodStart: periodStartSchema,
    status: monthStatusField,
    paidAt: paidAtField,
    accrued: canonicalMoneySchema,
  })
  .strict()
  .refine(hasMarkerState, MARKER_STATE_MESSAGE)

const pad2 = (part: number): string => String(part).padStart(2, '0')

export const dailyPayYearSchema = z
  .object({
    year: z.number().int(),
    months: z
      .array(dailyPayHistoryMonthSchema)
      .length(12, 'Annual history must contain exactly twelve months'),
  })
  .strict()
  .refine(
    (history) =>
      history.months.every(
        (month, index) => month.periodStart === `${history.year}-${pad2(index + 1)}-01`
      ),
    'History months must be the twelve calendar months of the year, in order'
  )

export const setDailyRateSchema = z
  .object({ dailyRate: positiveMoneyInputSchema.nullable() })
  .strict()

export const markPaidCommandSchema = z.object({}).strict()

export const revertMonthCommandSchema = z
  .object({ reason: z.string().min(1, 'Revert reason must not be empty').optional() })
  .strict()

export const periodStartQuerySchema = z.object({ periodStart: periodStartSchema }).strict()

export const historyYearQuerySchema = z
  .object({ year: z.string().regex(YEAR_PATTERN, 'Year must be a four-digit YYYY string') })
  .strict()

export type SetDailyRateInput = z.infer<typeof setDailyRateSchema>
export type MarkPaidCommandInput = z.infer<typeof markPaidCommandSchema>
export type RevertMonthCommandInput = z.infer<typeof revertMonthCommandSchema>
export type PeriodStartQueryInput = z.infer<typeof periodStartQuerySchema>
export type HistoryYearQueryInput = z.infer<typeof historyYearQuerySchema>
