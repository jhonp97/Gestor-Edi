import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const zone = 'Europe/Madrid'
const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function localParts(date: Date) {
  const values = Object.fromEntries(parts.formatToParts(date).map(part => [part.type, Number(part.value)]))
  return values as Record<'year' | 'month' | 'day' | 'hour' | 'minute', number>
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
    const displayed = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
    instant += target - displayed
  }
  return new Date(instant)
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

export async function loadFleetMonthlyReport(organizationId: string, selectedTruck: string, month: string) {
  if (!organizationId || !selectedTruck || (selectedTruck !== 'all' && !/^[\w-]+$/.test(selectedTruck))) throw new InvalidFleetSelectionError('Invalid fleet selection')
  const { start, end, civilStart, civilEnd } = madridMonthRange(month)
  const trucks = await prisma.truck.findMany({ where: { organizationId }, select: { id: true, plate: true }, orderBy: { plate: 'asc' } })
  if (selectedTruck !== 'all' && !trucks.some(truck => truck.id === selectedTruck)) throw new InvalidFleetSelectionError('Truck not found')
  if (trucks.length === 0) return { month, selectedTruck, trucks, byTruck: [], transactions: [], segments: [], totals: recordedTotals([]), workerDays: 0 }
  const truckId = selectedTruck === 'all' ? { in: trucks.map(truck => truck.id) } : selectedTruck
  const [transactions, segments] = await Promise.all([
    prisma.transaction.findMany({ where: { organizationId, truckId, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: start, lt: end } }, select: { id: true, truckId: true, date: true, type: true, amount: true, description: true, category: true }, orderBy: { date: 'desc' } }),
    prisma.workerDayTruckSegment.findMany({ where: { organizationId, truckId, workDate: { gte: civilStart, lt: civilEnd }, operation: { organizationId, dailyPayDay: { organizationId, worker: { organizationId } } } }, select: { id: true, truckId: true, workDate: true, share: true, kilometers: true, incident: true, operation: { select: { companyName: true, dailyPayDay: { select: { id: true, worker: { select: { name: true } } } } } } }, orderBy: { workDate: 'desc' } }),
  ])
  const byTruck = trucks.filter(truck => selectedTruck === 'all' || truck.id === selectedTruck).map(truck => ({ ...truck, totals: recordedTotals(transactions.filter(row => row.truckId === truck.id)) }))
  return { month, selectedTruck, trucks, byTruck, transactions, segments, totals: recordedTotals(transactions), workerDays: new Set(segments.map(segment => segment.operation.dailyPayDay.id)).size }
}

export function madridTimestamp(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }).format(date)
}
