import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  DailyPayDateError,
  DailyPayMoneyError,
  DailyPayRateError,
  accruedTotals,
  annualHistoryMonths,
  civilWeekRange,
  formatCivilDate,
  parseCivilDate,
  parseDailyRate,
  snapshotRate,
  sumMoney,
  toMoney,
  weekRange,
} from '@/lib/daily-pay'
import { ZodError } from 'zod'
import * as dailyPaySchemas from '@/schemas/daily-pay.schema'
import {
  dailyPayMonthSchema,
  dailyPayYearSchema,
  historyYearQuerySchema,
  markPaidCommandSchema,
  periodStartQuerySchema,
  revertMonthCommandSchema,
  setDailyRateSchema,
} from '@/schemas/daily-pay.schema'

// Fixtures derived from the worker-daily-pay-accrual and month-control specs.
const BASE_RATE = '100'
const RAISED_RATE = '120'
const DECIMAL_RATE = '100.25'
const SPEC_MONTH_SNAPSHOTS = ['100.25', '100.25', '100.25']
const SPEC_MONTH_ACCRUED = '300.75'

describe('daily-pay money helpers', () => {
  describe('toMoney', () => {
    it('canonicalizes integer and decimal inputs to exactly two decimals', () => {
      expect(toMoney(BASE_RATE)).toBe('100.00')
      expect(toMoney(100.5)).toBe('100.50')
    })

    it('accepts Prisma.Decimal values and rounds to exactly two decimals', () => {
      expect(toMoney(new Prisma.Decimal('123.4'))).toBe('123.40')
      expect(toMoney('99.999')).toBe('100.00')
    })

    it('collapses binary-float display drift into a canonical string', () => {
      expect(toMoney(0.1 + 0.2)).toBe('0.30')
    })

    it('rejects non-finite numbers and unparseable strings', () => {
      expect(() => toMoney(Number.NaN)).toThrow(DailyPayMoneyError)
      expect(() => toMoney(Number.POSITIVE_INFINITY)).toThrow(DailyPayMoneyError)
      expect(() => toMoney('abc')).toThrow(DailyPayMoneyError)
    })
  })

  describe('sumMoney', () => {
    it('adds decimal strings exactly without binary-float drift', () => {
      expect(sumMoney(['0.1', '0.2'])).toBe('0.30')
    })

    it('returns a zero total for an empty list', () => {
      expect(sumMoney([])).toBe('0.00')
    })

    it('rejects entries that are not valid money', () => {
      expect(() => sumMoney(['100', 'oops'])).toThrow(DailyPayMoneyError)
    })
  })

  describe('parseDailyRate', () => {
    it('accepts positive rates and canonicalizes them to two decimals', () => {
      expect(parseDailyRate(BASE_RATE)).toBe('100.00')
      expect(parseDailyRate(DECIMAL_RATE)).toBe('100.25')
      expect(parseDailyRate('1e2')).toBe('100.00')
    })

    it('rejects non-finite rates as invalid money', () => {
      expect(() => parseDailyRate(Number.NaN)).toThrow(DailyPayMoneyError)
      expect(() => parseDailyRate(Number.NEGATIVE_INFINITY)).toThrow(DailyPayMoneyError)
    })

    it('rejects negative and zero rates', () => {
      expect(() => parseDailyRate('-0.01')).toThrow(DailyPayRateError)
      expect(() => parseDailyRate('0')).toThrow(DailyPayRateError)
      expect(() => parseDailyRate('-100')).toThrow(DailyPayRateError)
    })
  })

  describe('snapshotRate', () => {
    it('snapshots the rate in effect when a day is marked', () => {
      expect(snapshotRate(BASE_RATE)).toBe('100.00')
    })

    it('snapshots later rates independently of earlier marks', () => {
      expect(snapshotRate(RAISED_RATE)).toBe('120.00')
      expect(snapshotRate(DECIMAL_RATE)).toBe('100.25')
    })

    it('denies accrual when the worker has no daily rate', () => {
      expect(() => snapshotRate(null)).toThrow(DailyPayRateError)
      expect(() => snapshotRate(undefined)).toThrow(DailyPayRateError)
    })
  })
})

describe('daily-pay civil dates', () => {
  it('parses strict YYYY-MM-DD into UTC midnight', () => {
    const parsed = parseCivilDate('2026-08-31')
    expect(parsed.getUTCFullYear()).toBe(2026)
    expect(parsed.getUTCMonth()).toBe(7)
    expect(parsed.getUTCDate()).toBe(31)
    expect(parsed.getUTCHours()).toBe(0)
  })

  it('round-trips through formatCivilDate for boundary dates', () => {
    for (const value of ['2024-02-29', '2024-12-31', '2025-01-01']) {
      expect(formatCivilDate(parseCivilDate(value))).toBe(value)
    }
  })

  it('emits civil dates from UTC fields, never from local time', () => {
    expect(formatCivilDate(new Date(Date.UTC(2026, 7, 31, 23, 59, 59)))).toBe('2026-08-31')
  })

  it('rejects impossible calendar dates', () => {
    expect(() => parseCivilDate('2026-02-30')).toThrow(DailyPayDateError)
    expect(() => parseCivilDate('2023-02-29')).toThrow(DailyPayDateError)
    expect(() => parseCivilDate('2100-02-29')).toThrow(DailyPayDateError)
  })

  it('rejects malformed inputs instead of coercing them', () => {
    for (const value of ['2026-1-1', '20260831', '31-08-2026', '2026-08-31T00:00:00Z', '']) {
      expect(() => parseCivilDate(value)).toThrow(DailyPayDateError)
    }
  })
})

describe('daily-pay Monday-to-Sunday weeks', () => {
  it('assigns Sunday to the week that ends on it', () => {
    expect(civilWeekRange('2026-08-30')).toEqual({ start: '2026-08-24', end: '2026-08-30' })
  })

  it('assigns the following Monday to the next week, crossing the month edge', () => {
    expect(civilWeekRange('2026-08-31')).toEqual({ start: '2026-08-31', end: '2026-09-06' })
  })

  it('keeps Monday-to-Sunday weeks intact across the year boundary', () => {
    expect(civilWeekRange('2026-01-01')).toEqual({ start: '2025-12-29', end: '2026-01-04' })
  })

  it('handles February boundaries in non-leap and leap years', () => {
    expect(civilWeekRange('2026-03-01')).toEqual({ start: '2026-02-23', end: '2026-03-01' })
    expect(civilWeekRange('2024-03-02')).toEqual({ start: '2024-02-26', end: '2024-03-03' })
  })

  it('computes the same week from a Date input using UTC arithmetic', () => {
    const { start, end } = weekRange(new Date(Date.UTC(2026, 7, 30, 15, 0, 0)))
    expect(formatCivilDate(start)).toBe('2026-08-24')
    expect(formatCivilDate(end)).toBe('2026-08-30')
  })
})

describe('daily-pay accrued totals', () => {
  it('sums rate snapshots exactly as the spec scenario', () => {
    expect(accruedTotals(SPEC_MONTH_SNAPSHOTS)).toEqual({ accrued: SPEC_MONTH_ACCRUED })
  })

  it('sums recurring fractions without binary-float drift', () => {
    expect(accruedTotals(['33.33', '33.33', '33.34'])).toEqual({ accrued: '100.00' })
  })

  it('returns a zero accrual for a period without worked days', () => {
    expect(accruedTotals([])).toEqual({ accrued: '0.00' })
  })

  it('exposes accrued only — no paid or balance key exists', () => {
    expect(Object.keys(accruedTotals(['100.00', '50.25']))).toEqual(['accrued'])
  })

  it('rejects entries that are not valid money', () => {
    expect(() => accruedTotals(['100', 'oops'])).toThrow(DailyPayMoneyError)
  })
})

describe('daily-pay annual history synthesis', () => {
  it('synthesizes twelve ordered PENDING months when a year has no history', () => {
    const months = annualHistoryMonths(2026, [])
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ periodStart: '2026-01-01', status: 'PENDING', paidAt: null, accrued: '0.00' })
    expect(months[11]).toEqual({ periodStart: '2026-12-01', status: 'PENDING', paidAt: null, accrued: '0.00' })
    expect(months.map((month) => month.periodStart)).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01',
      '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01',
    ])
  })

  it('slots a provided PAID month into its calendar month and synthesizes the rest', () => {
    const months = annualHistoryMonths(2026, [
      { periodStart: '2026-08-01', status: 'PAID', paidAt: '2026-09-02T12:00:00.000Z', accrued: SPEC_MONTH_ACCRUED },
    ])
    expect(months[7]).toEqual({
      periodStart: '2026-08-01',
      status: 'PAID',
      paidAt: '2026-09-02T12:00:00.000Z',
      accrued: SPEC_MONTH_ACCRUED,
    })
    expect(months[6]).toEqual({ periodStart: '2026-07-01', status: 'PENDING', paidAt: null, accrued: '0.00' })
    expect(months).toHaveLength(12)
  })

  it('preserves a provided PENDING month verbatim', () => {
    const months = annualHistoryMonths(2025, [
      { periodStart: '2025-02-01', status: 'PENDING', paidAt: null, accrued: '150.50' },
    ])
    expect(months[1]).toEqual({ periodStart: '2025-02-01', status: 'PENDING', paidAt: null, accrued: '150.50' })
  })

  it('rejects entries whose periodStart is not the first of the month', () => {
    expect(() =>
      annualHistoryMonths(2026, [{ periodStart: '2026-08-15', status: 'PENDING', paidAt: null, accrued: '0.00' }])
    ).toThrow(DailyPayDateError)
  })

  it('rejects entries that belong to a different year', () => {
    expect(() =>
      annualHistoryMonths(2026, [{ periodStart: '2025-08-01', status: 'PENDING', paidAt: null, accrued: '0.00' }])
    ).toThrow(DailyPayDateError)
  })
})

// Amended month DTO: accrued-only totals, PENDING|PAID status, nullable ISO paidAt.
const MONTH_DTO = {
  workerId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  periodStart: '2026-08-01',
  dailyRate: '100.00',
  status: 'PENDING',
  paidAt: null,
  days: [{ date: '2026-08-03', rateSnapshot: '100.00' }],
  totals: { accrued: '100.00' },
}

const PAID_MONTH_DTO = { ...MONTH_DTO, status: 'PAID', paidAt: '2026-09-02T12:30:00.000Z' }

describe('daily-pay month DTO contract', () => {
  it('accepts canonical PENDING and PAID months and preserves every value verbatim', () => {
    expect(dailyPayMonthSchema.parse(MONTH_DTO)).toEqual(MONTH_DTO)
    expect(dailyPayMonthSchema.parse({ ...MONTH_DTO, dailyRate: null })).toEqual({
      ...MONTH_DTO,
      dailyRate: null,
    })
    expect(dailyPayMonthSchema.parse(PAID_MONTH_DTO)).toEqual(PAID_MONTH_DTO)
  })

  it('rejects floating-point and Decimal-object money at the JSON boundary', () => {
    expect(() => dailyPayMonthSchema.parse({ ...MONTH_DTO, totals: { accrued: 100.25 } })).toThrow(ZodError)
    expect(() =>
      dailyPayMonthSchema.parse({
        ...MONTH_DTO,
        days: [{ date: '2026-08-03', rateSnapshot: new Prisma.Decimal('100.00') }],
      })
    ).toThrow(ZodError)
  })

  it('rejects money strings that are not exactly two decimals', () => {
    for (const accrued of ['100', '100.5', '100.2500']) {
      expect(() => dailyPayMonthSchema.parse({ ...MONTH_DTO, totals: { accrued } })).toThrow(ZodError)
    }
  })

  it('rejects a workerId that is not a UUID', () => {
    expect(() => dailyPayMonthSchema.parse({ ...MONTH_DTO, workerId: 'worker-1' })).toThrow(ZodError)
  })

  it('rejects a status outside the PENDING/PAID enum', () => {
    for (const status of ['OPEN', 'CLOSED', 'open']) {
      expect(() => dailyPayMonthSchema.parse({ ...MONTH_DTO, status })).toThrow(ZodError)
    }
  })

  it('enforces the marker invariant: PAID iff paidAt is present', () => {
    expect(() => dailyPayMonthSchema.parse({ ...MONTH_DTO, status: 'PAID', paidAt: null })).toThrow(ZodError)
    expect(() =>
      dailyPayMonthSchema.parse({ ...MONTH_DTO, status: 'PENDING', paidAt: '2026-09-02T12:30:00.000Z' })
    ).toThrow(ZodError)
  })

  it('accepts ISO-8601 UTC paidAt timestamps and rejects naive or non-string values', () => {
    expect(
      dailyPayMonthSchema.parse({ ...PAID_MONTH_DTO, paidAt: '2026-09-02T12:30:00Z' }).paidAt
    ).toBe('2026-09-02T12:30:00Z')
    for (const paidAt of ['2026-09-02T12:30:00', '2026-09-02', '15/09/2026', 1760000000000]) {
      expect(() => dailyPayMonthSchema.parse({ ...PAID_MONTH_DTO, paidAt })).toThrow(ZodError)
    }
  })

  it('rejects impossible calendar dates inside the DTO', () => {
    expect(() => dailyPayMonthSchema.parse({ ...MONTH_DTO, periodStart: '2026-02-30' })).toThrow(ZodError)
    expect(() =>
      dailyPayMonthSchema.parse({ ...MONTH_DTO, days: [{ date: '2026-04-31', rateSnapshot: '100.00' }] })
    ).toThrow(ZodError)
  })

  it('rejects a periodStart that is not the first of the month', () => {
    expect(() => dailyPayMonthSchema.parse({ ...MONTH_DTO, periodStart: '2026-08-15' })).toThrow(ZodError)
  })

  it('rejects payment-accounting fields so no ledger data can re-enter the DTO', () => {
    expect(() => dailyPayMonthSchema.parse({ ...MONTH_DTO, payments: [] })).toThrow(ZodError)
    expect(() =>
      dailyPayMonthSchema.parse({ ...MONTH_DTO, totals: { accrued: '100.00', paid: '50.00' } })
    ).toThrow(ZodError)
    expect(() =>
      dailyPayMonthSchema.parse({ ...MONTH_DTO, totals: { accrued: '100.00', balance: '50.00' } })
    ).toThrow(ZodError)
  })

  it('rejects unknown fields so no internal column can leak into responses', () => {
    expect(() => dailyPayMonthSchema.parse({ ...MONTH_DTO, organizationId: 'org-1' })).toThrow(ZodError)
  })
})

// Year DTO: annual history is exactly the twelve calendar months of the year.
// The builder slots per-month overrides onto an otherwise PENDING/absent year.
type YearMonthFixture = {
  periodStart: string
  status: 'PENDING' | 'PAID'
  paidAt: string | null
  accrued: string
}

function yearMonthsFixture(
  overrides: Record<number, Partial<YearMonthFixture>> = {}
): YearMonthFixture[] {
  return Array.from({ length: 12 }, (_, index) => ({
    periodStart: `2026-${String(index + 1).padStart(2, '0')}-01`,
    status: 'PENDING',
    paidAt: null,
    accrued: '0.00',
    ...overrides[index],
  }))
}

const YEAR_DTO = {
  year: 2026,
  months: yearMonthsFixture({
    0: { status: 'PAID', paidAt: '2026-02-01T10:00:00.000Z', accrued: SPEC_MONTH_ACCRUED },
    7: { accrued: '100.00' },
  }),
}

describe('daily-pay year DTO contract', () => {
  it('accepts a canonical annual history and preserves every value verbatim', () => {
    expect(dailyPayYearSchema.parse(YEAR_DTO)).toEqual(YEAR_DTO)
  })

  it('rejects histories that do not contain exactly twelve months', () => {
    expect(() =>
      dailyPayYearSchema.parse({ ...YEAR_DTO, months: YEAR_DTO.months.slice(0, 11) })
    ).toThrow(ZodError)
    expect(() =>
      dailyPayYearSchema.parse({ ...YEAR_DTO, months: [...YEAR_DTO.months, YEAR_DTO.months[0]] })
    ).toThrow(ZodError)
  })

  it('rejects months that are not the ordered calendar months of the year', () => {
    const swapped = YEAR_DTO.months.map((month, index) =>
      index === 0 ? YEAR_DTO.months[1] : index === 1 ? YEAR_DTO.months[0] : month
    )
    expect(() => dailyPayYearSchema.parse({ ...YEAR_DTO, months: swapped })).toThrow(ZodError)
    expect(() =>
      dailyPayYearSchema.parse({
        ...YEAR_DTO,
        months: [{ ...YEAR_DTO.months[0], periodStart: '2025-12-01' }, ...YEAR_DTO.months.slice(1)],
      })
    ).toThrow(ZodError)
  })

  it('rejects entries with an invalid status, non-canonical accrual, or broken marker state', () => {
    const invalidEntries: Array<[number, object]> = [
      [0, { ...YEAR_DTO.months[0], status: 'OPEN' }],
      [1, { ...YEAR_DTO.months[1], accrued: '300' }],
      [0, { ...YEAR_DTO.months[0], paidAt: null }],
    ]
    for (const [index, entry] of invalidEntries) {
      const months = YEAR_DTO.months.map((month, position) => (position === index ? entry : month))
      expect(() => dailyPayYearSchema.parse({ ...YEAR_DTO, months })).toThrow(ZodError)
    }
  })
})

describe('daily-pay rate command', () => {
  it('accepts a positive decimal rate and preserves its value', () => {
    expect(setDailyRateSchema.parse({ dailyRate: '100.25' })).toEqual({ dailyRate: '100.25' })
    expect(setDailyRateSchema.parse({ dailyRate: '80' })).toEqual({ dailyRate: '80' })
  })

  it('accepts null to clear the optional daily rate', () => {
    expect(setDailyRateSchema.parse({ dailyRate: null })).toEqual({ dailyRate: null })
  })

  it('rejects zero, negative, and non-numeric rates', () => {
    for (const dailyRate of ['0', '-1', 'abc', '']) {
      expect(() => setDailyRateSchema.parse({ dailyRate })).toThrow(ZodError)
    }
  })

  it('rejects a JSON-number rate because money crosses JSON only as strings', () => {
    expect(() => setDailyRateSchema.parse({ dailyRate: 100.25 })).toThrow(ZodError)
  })

  it('rejects unknown fields and a missing rate', () => {
    expect(() => setDailyRateSchema.parse({ dailyRate: '100.00', month: '2026-08-01' })).toThrow(ZodError)
    expect(() => setDailyRateSchema.parse({})).toThrow(ZodError)
  })
})

describe('daily-pay mark-paid command', () => {
  it('accepts the strict empty mark-paid command', () => {
    expect(markPaidCommandSchema.parse({})).toEqual({})
  })

  it('rejects every field because marking is manual and parameterless', () => {
    for (const body of [{ force: true }, { accrued: SPEC_MONTH_ACCRUED }, { reason: 'x' }]) {
      expect(() => markPaidCommandSchema.parse(body)).toThrow(ZodError)
    }
  })

  it('rejects non-object payloads', () => {
    expect(() => markPaidCommandSchema.parse(null)).toThrow(ZodError)
    expect(() => markPaidCommandSchema.parse('mark')).toThrow(ZodError)
  })
})

describe('daily-pay revert command', () => {
  it('accepts a revert without a reason', () => {
    expect(revertMonthCommandSchema.parse({})).toEqual({})
  })

  it('accepts a non-empty reason and preserves it', () => {
    expect(revertMonthCommandSchema.parse({ reason: 'Worked day removed by mistake' })).toEqual({
      reason: 'Worked day removed by mistake',
    })
  })

  it('rejects an empty reason, non-string reasons, and unknown fields', () => {
    expect(() => revertMonthCommandSchema.parse({ reason: '' })).toThrow(ZodError)
    expect(() => revertMonthCommandSchema.parse({ reason: 42 })).toThrow(ZodError)
    expect(() => revertMonthCommandSchema.parse({ reason: 'ok', force: true })).toThrow(ZodError)
  })
})

describe('daily-pay history query', () => {
  it('accepts a four-digit year', () => {
    expect(historyYearQuerySchema.parse({ year: '2026' })).toEqual({ year: '2026' })
  })

  it('rejects malformed, missing, non-string years, and unknown fields', () => {
    for (const query of [{ year: '26' }, { year: '20a6' }, { year: 2026 }, {}]) {
      expect(() => historyYearQuerySchema.parse(query)).toThrow(ZodError)
    }
    expect(() => historyYearQuerySchema.parse({ year: '2026', month: '08' })).toThrow(ZodError)
  })
})

describe('daily-pay month query', () => {
  it('accepts a first-of-month period start', () => {
    expect(periodStartQuerySchema.parse({ periodStart: '2026-09-01' })).toEqual({
      periodStart: '2026-09-01',
    })
  })

  it('rejects mid-month, malformed, and missing period starts', () => {
    expect(() => periodStartQuerySchema.parse({ periodStart: '2026-09-02' })).toThrow(ZodError)
    expect(() => periodStartQuerySchema.parse({ periodStart: '2026-13-01' })).toThrow(ZodError)
    expect(() => periodStartQuerySchema.parse({})).toThrow(ZodError)
  })
})

describe('daily-pay payment API removal', () => {
  it('exposes no payment-ledger command on the schema surface', () => {
    const surface = dailyPaySchemas as unknown as Record<string, unknown>
    expect(surface.recordPaymentSchema).toBeUndefined()
    expect(surface.reopenMonthSchema).toBeUndefined()
  })

  it('exposes the amended contract surface', () => {
    for (const key of [
      'dailyPayMonthSchema',
      'dailyPayYearSchema',
      'markPaidCommandSchema',
      'revertMonthCommandSchema',
      'historyYearQuerySchema',
      'setDailyRateSchema',
      'periodStartQuerySchema',
      'civilDateSchema',
      'periodStartSchema',
      'canonicalMoneySchema',
    ]) {
      expect(dailyPaySchemas[key as keyof typeof dailyPaySchemas]).toBeDefined()
    }
  })
})
