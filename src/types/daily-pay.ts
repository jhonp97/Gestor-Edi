/**
 * JSON DTO contracts for worker daily-pay accrual. Money values are
 * canonical two-decimal strings and civil dates are strict YYYY-MM-DD
 * strings, so no Decimal object or floating-point money ever crosses the
 * JSON boundary. The DTO exposes accrued value only: there are no payment
 * records, amounts paid, partial payments, balances, or overpayment state.
 * paidAt is a nullable ISO-8601 UTC timestamp following the marker
 * invariant: PENDING months carry null and PAID months carry the stamp.
 */

export type Money = string
export type CivilDate = string
export type MonthStatus = 'PENDING' | 'PAID'

export type DailyPayDayDTO = {
  date: CivilDate
  rateSnapshot: Money
}

export type DailyPayTotalsDTO = {
  accrued: Money
}

export type DailyPayMonthDTO = {
  workerId: string
  periodStart: CivilDate
  dailyRate: Money | null
  status: MonthStatus
  paidAt: string | null
  days: DailyPayDayDTO[]
  totals: DailyPayTotalsDTO
}

export type DailyPayHistoryMonthDTO = Pick<
  DailyPayMonthDTO,
  'periodStart' | 'status' | 'paidAt'
> & { accrued: Money }

export type DailyPayYearDTO = {
  year: number
  months: DailyPayHistoryMonthDTO[]
}
