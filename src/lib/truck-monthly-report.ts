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

export async function loadTruckMonthlyReport(organizationId: string, truckId: string, month: string) {
  if (!organizationId || !truckId) throw new Error('Tenant and truck required')
  const { start, end, civilStart, civilEnd } = madridMonthRange(month)
  const [transactions, segments] = await Promise.all([
    prisma.transaction.findMany({ where: { organizationId, truckId, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: start, lt: end } }, select: { id: true, date: true, type: true, amount: true, description: true, category: true }, orderBy: { date: 'desc' } }),
    prisma.workerDayTruckSegment.findMany({ where: { organizationId, truckId, workDate: { gte: civilStart, lt: civilEnd }, operation: { organizationId, dailyPayDay: { organizationId, worker: { organizationId } } } }, select: { id: true, workDate: true, share: true, kilometers: true, incident: true, operation: { select: { companyName: true, dailyPayDay: { select: { worker: { select: { name: true } } } } } } }, orderBy: { workDate: 'desc' } }),
  ])
  return { month, transactions, segments, totals: recordedTotals(transactions) }
}

export class InvalidFleetSelectionError extends Error {}

export async function loadFleetMonthlyReport(organizationId: string, selectedTruck: string, month: string, period: ReportPeriod = 'month') {
  if (!organizationId || !selectedTruck || (selectedTruck !== 'all' && !/^[\w-]+$/.test(selectedTruck))) throw new InvalidFleetSelectionError('Invalid fleet selection')
  const { start, end, civilStart, civilEnd } = madridPeriodRange(month, period)
  const trucks = await prisma.truck.findMany({ where: { organizationId }, select: { id: true, plate: true }, orderBy: { plate: 'asc' } })
  if (selectedTruck !== 'all' && !trucks.some(truck => truck.id === selectedTruck)) throw new InvalidFleetSelectionError('Truck not found')
  if (trucks.length === 0) return { month, period, selectedTruck, trucks, byTruck: [], transactions: [], segments: [], totals: recordedTotals([]), workerDays: 0 }
  const truckId = selectedTruck === 'all' ? { in: trucks.map(truck => truck.id) } : selectedTruck
  if (period !== 'month') {
    const sums = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal }>()
    const total = { income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) }
    const dayIds = new Set<string>()
    const batchSize = 200
    let transactionCursor: string | undefined
    while (true) {
      const rows = await prisma.transaction.findMany({ where: { organizationId, truckId, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: start, lt: end } }, select: { id: true, truckId: true, type: true, amount: true }, orderBy: { id: 'asc' }, take: batchSize, ...(transactionCursor ? { cursor: { id: transactionCursor }, skip: 1 } : {}) })
      for (const row of rows) {
        const key = row.type === 'INCOME' ? 'income' : 'expense'
        const amounts = sums.get(row.truckId) ?? { income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) }
        const amount = new Prisma.Decimal(String(row.amount))
        amounts[key] = amounts[key].plus(amount)
        total[key] = total[key].plus(amount)
        sums.set(row.truckId, amounts)
      }
      if (rows.length < batchSize) break
      transactionCursor = rows[rows.length - 1].id
    }
    let segmentCursor: string | undefined
    while (true) {
      const rows = await prisma.workerDayTruckSegment.findMany({ where: { organizationId, truckId, workDate: { gte: civilStart, lt: civilEnd }, operation: { organizationId, dailyPayDay: { organizationId, worker: { organizationId } } } }, select: { id: true, operation: { select: { dailyPayDay: { select: { id: true } } } } }, orderBy: { id: 'asc' }, take: batchSize, ...(segmentCursor ? { cursor: { id: segmentCursor }, skip: 1 } : {}) })
      for (const row of rows) dayIds.add(row.operation.dailyPayDay.id)
      if (rows.length < batchSize) break
      segmentCursor = rows[rows.length - 1].id
    }
    const formatted = (value: { income: Prisma.Decimal; expense: Prisma.Decimal }) => ({ income: value.income.toFixed(2), expense: value.expense.toFixed(2) })
    return { month, period, selectedTruck, trucks, byTruck: trucks.filter(truck => selectedTruck === 'all' || truck.id === selectedTruck).map(truck => ({ ...truck, totals: formatted(sums.get(truck.id) ?? { income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) }) })), transactions: [], segments: [], totals: formatted(total), workerDays: dayIds.size }
  }
  const [transactions, segments] = await Promise.all([
    prisma.transaction.findMany({ where: { organizationId, truckId, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: start, lt: end } }, select: { id: true, truckId: true, date: true, type: true, amount: true, description: true, category: true }, orderBy: { date: 'desc' } }),
    prisma.workerDayTruckSegment.findMany({ where: { organizationId, truckId, workDate: { gte: civilStart, lt: civilEnd }, operation: { organizationId, dailyPayDay: { organizationId, worker: { organizationId } } } }, select: { id: true, truckId: true, workDate: true, share: true, kilometers: true, incident: true, operation: { select: { companyName: true, dailyPayDay: { select: { id: true, worker: { select: { name: true } } } } } } }, orderBy: { workDate: 'desc' } }),
  ])
  const byTruck = trucks.filter(truck => selectedTruck === 'all' || truck.id === selectedTruck).map(truck => ({ ...truck, totals: recordedTotals(transactions.filter(row => row.truckId === truck.id)) }))
  return { month, period, selectedTruck, trucks, byTruck, transactions, segments, totals: recordedTotals(transactions), workerDays: new Set(segments.map(segment => segment.operation.dailyPayDay.id)).size }
}

export function madridTimestamp(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }).format(date)
}
