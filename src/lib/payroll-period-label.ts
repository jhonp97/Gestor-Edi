interface PeriodLabelInput {
  month: number
  year: number
  periodStart?: Date | string | null
  periodEnd?: Date | string | null
}

export function calendarPayrollDates(month: number, year: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = `${year}-${String(month).padStart(2, '0')}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`
  return { start, end }
}

function civil(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
}

function displayDate(value: string) {
  return value.split('-').reverse().join('/')
}

/** Always format civil dates without converting them to the client's time zone. */
export function payrollPeriodLabel(input: PeriodLabelInput) {
  const fallback = calendarPayrollDates(input.month, input.year)
  const start = input.periodStart && input.periodEnd ? civil(input.periodStart) : fallback.start
  const end = input.periodStart && input.periodEnd ? civil(input.periodEnd) : fallback.end
  return `Del ${displayDate(start)} al ${displayDate(end)}`
}
