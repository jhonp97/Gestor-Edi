import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const zone = 'Europe/Madrid'
const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

function localParts(date: Date) {
  const values = Object.fromEntries(parts.formatToParts(date).map(part => [part.type, Number(part.value)]))
  return values as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

export function resolveReportMonth(value: string | string[] | undefined, now = new Date()): string {
  if (value === undefined) {
    const { year, month } = localParts(now)
    return `${year}-${String(month).padStart(2, '0')}`
  }
  if (typeof value !== 'string' || !/^(19|20|21)\d\d-(0[1-9]|1[0-2])$/.test(value)) throw new Error('Invalid report month')
  return value
}

function madridMidnight(year: number, month: number): Date {
  const target = Date.UTC(year, month - 1, 1)
  let instant = target
  // Midnight is unambiguous in Europe/Madrid for the supported calendar years.
  for (let step = 0; step < 3; step++) {
    const local = localParts(new Date(instant))
    const displayed = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)
    instant += target - displayed
  }
  return new Date(instant)
}

export type ReportPeriod = 'month' | 'quarter' | 'half-year' | 'year'

export function resolveReportPeriod(value: string | string[] | undefined): ReportPeriod {
  if (value === undefined) return 'month'
  if (value === 'month' || value === 'quarter' || value === 'half-year' || value === 'year') return value
  throw new Error('Invalid report period')
}

export function madridPeriodRange(month: string, period: ReportPeriod) {
  const [year, index] = resolveReportMonth(month).split('-').map(Number)
  const first = period === 'year' ? 1 : period === 'half-year' ? Math.floor((index - 1) / 6) * 6 + 1 : period === 'quarter' ? Math.floor((index - 1) / 3) * 3 + 1 : index
  const length = period === 'year' ? 12 : period === 'half-year' ? 6 : period === 'quarter' ? 3 : 1
  const endYear = first + length > 12 ? year + 1 : year
  const endMonth = (first + length - 1) % 12 + 1
  return { start: madridMidnight(year, first), end: madridMidnight(endYear, endMonth), civilStart: new Date(Date.UTC(year, first - 1, 1)), civilEnd: new Date(Date.UTC(endYear, endMonth - 1, 1)) }
}

export function madridMonthRange(month: string) {
  const valid = resolveReportMonth(month)
  const [year, index] = valid.split('-').map(Number)
  const nextYear = index === 12 ? year + 1 : year
  const nextMonth = index === 12 ? 1 : index + 1
  return { start: madridMidnight(year, index), end: madridMidnight(nextYear, nextMonth), civilStart: new Date(Date.UTC(year, index - 1, 1)), civilEnd: new Date(Date.UTC(nextYear, nextMonth - 1, 1)) }
}

export function sanitizeTransactionFilters(type: unknown, sort: unknown): { type: '' | 'INCOME' | 'EXPENSE'; sort: 'asc' | 'desc' } {
  return { type: type === 'INCOME' || type === 'EXPENSE' ? type : '', sort: sort === 'asc' ? 'asc' : 'desc' }
}

export function recordedAmount(amount: number): string {
  const decimal = new Prisma.Decimal(String(amount))
  return decimal.decimalPlaces() > 2 ? decimal.toString() : decimal.toFixed(2)
}

export function recordedTotals(rows: readonly { type: string; amount: number }[]) {
  let income = new Prisma.Decimal(0)
  let expense = new Prisma.Decimal(0)
  for (const row of rows) {
    if (row.type === 'INCOME') income = income.plus(new Prisma.Decimal(String(row.amount)))
    if (row.type === 'EXPENSE') expense = expense.plus(new Prisma.Decimal(String(row.amount)))
  }
  return { income: income.toFixed(2), expense: expense.toFixed(2) }
}

export class InvalidReportCursorError extends Error {}

export type ReportCursors = { transactions?: string | string[]; segments?: string | string[] }
export type DetailPage = { previous: string | null; next: string | null; current: string | undefined; hasMore: boolean; count: number }
const detailSize = 50

function parseCursor(value: string | string[] | undefined) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length > 160 || !/^(next|prev):[\w-]+$/.test(value)) throw new InvalidReportCursorError('Invalid report cursor')
  const [direction, id] = value.split(':')
  return { direction, id }
}

export function validateReportCursors(cursors: ReportCursors) {
  parseCursor(cursors.transactions)
  parseCursor(cursors.segments)
  return cursors
}

function detailPage<T extends { id: string }>(rows: T[], cursor: ReturnType<typeof parseCursor>, current: string | undefined) {
  const more = rows.length > detailSize
  const visible = rows.slice(0, detailSize)
  if (cursor?.direction === 'prev') visible.reverse()
  if (cursor && visible.length === 0) throw new InvalidReportCursorError('Empty cursor page')
  const previous = visible.length && (cursor?.direction === 'prev' ? more : !!cursor) ? `prev:${visible[0].id}` : null
  const next = visible.length && (cursor?.direction === 'prev' ? true : more) ? `next:${visible[visible.length - 1].id}` : null
  return { rows: visible, page: { previous, next, current, hasMore: next !== null, count: visible.length } }
}

async function streamTotals(where: Prisma.TransactionWhereInput) {
  const sums = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal }>()
  const total = { income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) }
  let cursor: string | undefined
  while (true) {
    const rows = await prisma.transaction.findMany({ where, select: { id: true, truckId: true, type: true, amount: true }, orderBy: { id: 'asc' }, take: 200, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
    for (const row of rows) {
      const key = row.type === 'INCOME' ? 'income' : 'expense'
      const amounts = sums.get(row.truckId) ?? { income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) }
      const amount = new Prisma.Decimal(String(row.amount))
      amounts[key] = amounts[key].plus(amount)
      total[key] = total[key].plus(amount)
      sums.set(row.truckId, amounts)
    }
    if (rows.length < 200) break
    cursor = rows[rows.length - 1].id
  }
  const formatted = (value: typeof total) => ({ income: value.income.toFixed(2), expense: value.expense.toFixed(2) })
  return { totals: formatted(total), forTruck: (id: string) => formatted(sums.get(id) ?? { income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) }) }
}

async function monthlyDetails(transactionWhere: Prisma.TransactionWhereInput, segmentWhere: Prisma.WorkerDayTruckSegmentWhereInput, cursors: ReportCursors) {
  const tx = parseCursor(cursors.transactions)
  const segment = parseCursor(cursors.segments)
  // Verify cursor membership before Prisma resolves its unique anchor.
  if (tx && !await prisma.transaction.findFirst({ where: { ...transactionWhere, id: tx.id }, select: { id: true } })) throw new InvalidReportCursorError('Transaction cursor not found')
  if (segment && !await prisma.workerDayTruckSegment.findFirst({ where: { ...segmentWhere, id: segment.id }, select: { id: true } })) throw new InvalidReportCursorError('Segment cursor not found')
  const txOrder = tx?.direction === 'prev' ? 'asc' : 'desc'
  const segmentOrder = segment?.direction === 'prev' ? 'asc' : 'desc'
  const [transactions, segments] = await Promise.all([
    prisma.transaction.findMany({ where: transactionWhere, select: { id: true, truckId: true, date: true, type: true, amount: true, description: true, category: true }, orderBy: [{ date: txOrder }, { id: txOrder }], take: detailSize + 1, ...(tx ? { cursor: { id: tx.id }, skip: 1 } : {}) }),
    prisma.workerDayTruckSegment.findMany({ where: segmentWhere, select: { id: true, truckId: true, workDate: true, share: true, kilometers: true, incident: true, operation: { select: { companyName: true, dailyPayDay: { select: { id: true, worker: { select: { name: true } } } } } } }, orderBy: [{ workDate: segmentOrder }, { id: segmentOrder }], take: detailSize + 1, ...(segment ? { cursor: { id: segment.id }, skip: 1 } : {}) }),
  ])
  const txPage = detailPage(transactions, tx, cursors.transactions as string | undefined)
  const segmentPage = detailPage(segments, segment, cursors.segments as string | undefined)
  return { transactions: txPage.rows, segments: segmentPage.rows, pages: { transactions: txPage.page, segments: segmentPage.page } }
}

export async function loadTruckMonthlyReport(organizationId: string, truckId: string, month: string, cursors: ReportCursors = {}) {
  if (!organizationId || !truckId) throw new Error('Tenant and truck required')
  const { start, end, civilStart, civilEnd } = madridMonthRange(month)
  validateReportCursors(cursors)
  const where: Prisma.TransactionWhereInput = { organizationId, truckId, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: start, lt: end } }
  const details = await monthlyDetails(where, { organizationId, truckId, workDate: { gte: civilStart, lt: civilEnd }, operation: { organizationId, dailyPayDay: { organizationId, worker: { organizationId } } } }, cursors)
  const totals = await streamTotals(where)
  return { month, ...details, totals: totals.totals }
}

export class InvalidFleetSelectionError extends Error {}

export async function loadFleetMonthlyReport(organizationId: string, selectedTruck: string, month: string, period: ReportPeriod = 'month', cursors: ReportCursors = {}) {
  validateReportCursors(cursors)
  if (period !== 'month' && (cursors.transactions !== undefined || cursors.segments !== undefined)) throw new InvalidReportCursorError('Aggregate period has no details')
  if (!organizationId || !selectedTruck || (selectedTruck !== 'all' && !/^[\w-]+$/.test(selectedTruck))) throw new InvalidFleetSelectionError('Invalid fleet selection')
  const { start, end, civilStart, civilEnd } = madridPeriodRange(month, period)
  const trucks = await prisma.truck.findMany({ where: { organizationId }, select: { id: true, plate: true }, orderBy: { plate: 'asc' } })
  if (selectedTruck !== 'all' && !trucks.some(truck => truck.id === selectedTruck)) throw new InvalidFleetSelectionError('Truck not found')
  const emptyDetails = { transactions: [], segments: [], pages: { transactions: detailPage([], undefined, undefined).page, segments: detailPage([], undefined, undefined).page } }
  if (trucks.length === 0) {
    if (cursors.transactions !== undefined || cursors.segments !== undefined) throw new InvalidReportCursorError('Cursor in empty fleet')
    return { month, period, selectedTruck, trucks, byTruck: [], ...emptyDetails, totals: recordedTotals([]), workerDays: 0 }
  }
  const truckId = selectedTruck === 'all' ? { in: trucks.map(truck => truck.id) } : selectedTruck
  const transactionWhere: Prisma.TransactionWhereInput = { organizationId, truckId, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: start, lt: end } }
  const segmentWhere: Prisma.WorkerDayTruckSegmentWhereInput = { organizationId, truckId, workDate: { gte: civilStart, lt: civilEnd }, operation: { organizationId, dailyPayDay: { organizationId, worker: { organizationId } } } }
  const details = period === 'month' ? await monthlyDetails(transactionWhere, segmentWhere, cursors) : emptyDetails
  const [amounts, workerDays] = await Promise.all([
    streamTotals(transactionWhere),
    // Count the parent workday once even when its operation has multiple selected segments.
    prisma.dailyPayDay.count({ where: { organizationId, worker: { organizationId }, workDate: { gte: civilStart, lt: civilEnd }, operation: { is: { organizationId, segments: { some: { organizationId, truckId, workDate: { gte: civilStart, lt: civilEnd } } } } } } }),
  ])
  const byTruck = trucks.filter(truck => selectedTruck === 'all' || truck.id === selectedTruck).map(truck => ({ ...truck, totals: amounts.forTruck(truck.id) }))
  return { month, period, selectedTruck, trucks, byTruck, ...details, totals: amounts.totals, workerDays }
}

export function madridTimestamp(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }).format(date)
}
