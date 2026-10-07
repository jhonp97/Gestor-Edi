import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { InvalidFleetSelectionError, madridMonthRange, resolveReportMonth } from '@/lib/truck-monthly-report'

export type ExportAssignment = { id: string; name: string; company: string; share: number }
export type ExportDay = { date: string; workers: ExportAssignment[]; km: string | null; income: string | null; expense: string | null }
export type ExportTruck = {
  id: string
  plate: string
  days: ExportDay[]
  workers: { id: string; name: string; dates: number; equivalentDays: string }[]
  totals: { km: string | null; income: string; expense: string; net: string }
}
export type TruckMonthlyExport = { month: string; trucks: ExportTruck[] }
export class ExportTooLargeError extends Error {}
const batchSize = 200
// Reject, never truncate. The bound also limits work during concurrent inserts.
const maxRecords = 50000
const madridDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
function financialDate(date: Date) {
  const parts = Object.fromEntries(madridDate.formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
const civilDate = (date: Date) => date.toISOString().slice(0, 10)
const decimal = (value: number) => new Prisma.Decimal(String(value))
type DayAccumulator = { date: string; workers: ExportAssignment[]; km: Prisma.Decimal | null; income: Prisma.Decimal | null; expense: Prisma.Decimal | null }

export async function loadTruckMonthlyExport(organizationId: string, selectedTruck: string, month: string): Promise<TruckMonthlyExport> {
  if (!organizationId || !selectedTruck || selectedTruck.length > 160 || !/^[\w-]+$/.test(selectedTruck)) throw new InvalidFleetSelectionError('Invalid fleet selection')
  month = resolveReportMonth(month)
  const { start, end, civilStart, civilEnd } = madridMonthRange(month)
  let records = 0
  async function fold<T extends { id: string }>(query: (after?: string) => Promise<T[]>, accept: (row: T) => void) {
    let after: string | undefined
    while (true) {
      const rows = await query(after)
      records += rows.length
      if (records > maxRecords) throw new ExportTooLargeError('Export too large')
      for (const row of rows) accept(row)
      if (rows.length < batchSize) return
      const next = rows[rows.length - 1].id
      if (after !== undefined && next <= after) throw new ExportTooLargeError('Export did not progress')
      after = next
    }
  }
  const trucks: { id: string; plate: string }[] = []
  await fold(after => prisma.truck.findMany({
    where: { organizationId, ...(selectedTruck === 'all' ? {} : { id: selectedTruck }), ...(after ? { id: { gt: after } } : {}) },
    select: { id: true, plate: true }, orderBy: { id: 'asc' }, take: batchSize,
  }), truck => { trucks.push(truck) })
  if (selectedTruck !== 'all' && !trucks.length) throw new InvalidFleetSelectionError('Truck not found')
  const output: ExportTruck[] = []
  // Process one authorized truck at a time; never carry raw month-sized row arrays.
  for (const truck of trucks.sort((a, b) => a.plate.localeCompare(b.plate) || a.id.localeCompare(b.id))) {
    const days = new Map<string, DayAccumulator>()
    const workers = new Map<string, { id: string; name: string; dates: Set<string>; shares: Prisma.Decimal }>()
    let income = new Prisma.Decimal(0)
    let expense = new Prisma.Decimal(0)
    const mileage: { total: Prisma.Decimal | null } = { total: null }
    function day(date: string) {
      let value = days.get(date)
      if (!value) {
        value = { date, workers: [], km: null, income: null, expense: null }
        days.set(date, value)
      }
      return value
    }
    const scope = { organizationId, truckId: truck.id, truck: { organizationId } }
    await fold(after => prisma.transaction.findMany({
      where: { ...scope, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: start, lt: end }, ...(after ? { id: { gt: after } } : {}) },
      select: { id: true, date: true, type: true, amount: true }, orderBy: { id: 'asc' }, take: batchSize,
    }), row => {
      const key = row.type === 'INCOME' ? 'income' : 'expense'
      const value = day(financialDate(row.date))
      const amount = decimal(row.amount)
      value[key] = (value[key] ?? new Prisma.Decimal(0)).plus(amount)
      if (key === 'income') income = income.plus(amount)
      else expense = expense.plus(amount)
    })
    await fold(after => prisma.workerDayTruckSegment.findMany({
      where: { ...scope, workDate: { gte: civilStart, lt: civilEnd }, operation: { organizationId, dailyPayDay: { organizationId, worker: { organizationId } } }, ...(after ? { id: { gt: after } } : {}) },
      select: { id: true, workDate: true, share: true, operation: { select: { companyName: true, dailyPayDay: { select: { worker: { select: { id: true, name: true } } } } } } },
      orderBy: { id: 'asc' }, take: batchSize,
    }), row => {
      const date = civilDate(row.workDate)
      const worker = row.operation.dailyPayDay.worker
      day(date).workers.push({ id: worker.id, name: worker.name, company: row.operation.companyName, share: row.share })
      const summary = workers.get(worker.id) ?? { ...worker, dates: new Set<string>(), shares: new Prisma.Decimal(0) }
      summary.dates.add(date)
      summary.shares = summary.shares.plus(row.share)
      workers.set(worker.id, summary)
    })
    // TruckMileage is a civil @db.Date and repositories sum km as distances, not odometer readings.
    await fold(after => prisma.truckMileage.findMany({
      where: { ...scope, date: { gte: civilStart, lt: civilEnd }, ...(after ? { id: { gt: after } } : {}) },
      select: { id: true, date: true, km: true }, orderBy: { id: 'asc' }, take: batchSize,
    }), row => {
      const value = day(civilDate(row.date))
      const distance = decimal(row.km)
      value.km = (value.km ?? new Prisma.Decimal(0)).plus(distance)
      mileage.total = (mileage.total ?? new Prisma.Decimal(0)).plus(distance)
    })
    output.push({ ...truck,
      days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map(value => ({ ...value,
        workers: value.workers.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
        km: value.km?.toString() ?? null, income: value.income?.toFixed(2) ?? null, expense: value.expense?.toFixed(2) ?? null,
      })),
      workers: [...workers.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map(worker => ({ id: worker.id, name: worker.name, dates: worker.dates.size, equivalentDays: worker.shares.dividedBy(100).toString() })),
      totals: { km: mileage.total?.toString() ?? null, income: income.toFixed(2), expense: expense.toFixed(2), net: income.minus(expense).toFixed(2) },
    })
  }
  return { month, trucks: output }
}
