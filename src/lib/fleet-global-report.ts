import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { madridPeriodRange, resolveReportMonth, resolveReportPeriod } from '@/lib/truck-monthly-report'
import type { FleetGlobalPeriod, FleetGlobalReport } from '@/lib/fleet-global-report-types'

export class InvalidGlobalFleetSelectionError extends Error {}
export class GlobalFleetReportTooLargeError extends Error {}

export function validateGlobalFleetSelection(truckIds: string[], month: string, period: FleetGlobalPeriod) {
  if (!Array.isArray(truckIds) || !truckIds.length || truckIds.length > 100 || new Set(truckIds).size !== truckIds.length || truckIds.some(id => typeof id !== 'string' || id === 'all' || id.length > 160 || !/^[\w-]+$/.test(id))) throw new InvalidGlobalFleetSelectionError('Invalid selection')
  try {
    if (typeof month !== 'string' || typeof period !== 'string') throw new Error('Required period')
    resolveReportMonth(month)
    resolveReportPeriod(period)
  } catch { throw new InvalidGlobalFleetSelectionError('Invalid period') }
}
const zero = () => new Prisma.Decimal(0)
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const equivalent = (value: Prisma.Decimal) => value.dividedBy(100).toString()
type Activity = { dates: Set<string>; shares: Prisma.Decimal }
const activity = (): Activity => ({ dates: new Set(), shares: zero() })

export async function loadFleetGlobalReport(organizationId: string, truckIds: string[], month: string, period: FleetGlobalPeriod): Promise<FleetGlobalReport> {
  validateGlobalFleetSelection(truckIds, month, period)
  if (!organizationId) throw new InvalidGlobalFleetSelectionError('Organization required')
  const ids = [...truckIds].sort(compare)
  // Authorize the complete selection before querying either source of report data.
  const trucks = await prisma.truck.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true, plate: true }, orderBy: { id: 'asc' }, take: 100 })
  if (trucks.length !== ids.length || ids.some(id => !trucks.some(truck => truck.id === id))) throw new InvalidGlobalFleetSelectionError('Truck not found')
  const { start, end, civilStart, civilEnd } = madridPeriodRange(month, period)
  let records = 0
  async function fold<T extends { id: string }>(query: (after?: string) => Promise<T[]>, accept: (row: T) => void) {
    let after: string | undefined
    while (true) {
      const rows = await query(after)
      records += rows.length
      if (records > 50000) throw new GlobalFleetReportTooLargeError('Report too large')
      let previous = after
      for (const row of rows) {
        if (previous !== undefined && row.id <= previous) throw new GlobalFleetReportTooLargeError('Report did not progress')
        accept(row)
        previous = row.id
      }
      if (rows.length < 200) return
      after = previous
    }
  }
  const byTruck = new Map(trucks.map(truck => [truck.id, { ...truck, ...activity(), fuel: zero() }]))
  const workers = new Map<string, Activity & { id: string; name: string }>()
  const companies = new Map<string, { name: string; truckDates: Set<string>; workerDates: Set<string>; shares: Prisma.Decimal }>()
  const calendar = new Set<string>()
  let shares = zero()
  let fuel = zero()
  const scope = { organizationId, truckId: { in: ids }, truck: { organizationId } }
  await fold(after => prisma.workerDayTruckSegment.findMany({
    where: { ...scope, workDate: { gte: civilStart, lt: civilEnd }, operation: { organizationId, dailyPayDay: { organizationId, worker: { organizationId } } }, ...(after ? { id: { gt: after } } : {}) },
    select: { id: true, truckId: true, workDate: true, share: true, operation: { select: { companyName: true, dailyPayDay: { select: { worker: { select: { id: true, name: true } } } } } } },
    orderBy: { id: 'asc' }, take: 200,
  }), row => {
    const truck = byTruck.get(row.truckId)!
    const date = row.workDate.toISOString().slice(0, 10)
    const person = row.operation.dailyPayDay.worker
    const worker = workers.get(person.id) ?? { ...person, ...activity() }
    const name = row.operation.companyName
    const company = companies.get(name) ?? { name, truckDates: new Set<string>(), workerDates: new Set<string>(), shares: zero() }
    calendar.add(date)
    truck.dates.add(date)
    worker.dates.add(date)
    // JSON tuples avoid collisions between arbitrary IDs and civil dates.
    company.truckDates.add(JSON.stringify([row.truckId, date]))
    company.workerDates.add(JSON.stringify([person.id, date]))
    const share = new Prisma.Decimal(String(row.share))
    truck.shares = truck.shares.plus(share)
    worker.shares = worker.shares.plus(share)
    company.shares = company.shares.plus(share)
    shares = shares.plus(share)
    workers.set(person.id, worker)
    companies.set(name, company)
  })
  await fold(after => prisma.transaction.findMany({
    where: { ...scope, type: 'EXPENSE', date: { gte: start, lt: end }, ...(after ? { id: { gt: after } } : {}) },
    select: { id: true, truckId: true, type: true, category: true, amount: true }, orderBy: { id: 'asc' }, take: 200,
  }), row => {
    if (row.type !== 'EXPENSE' || row.category?.trim().toLowerCase() !== 'combustible') return
    const amount = new Prisma.Decimal(String(row.amount))
    const truck = byTruck.get(row.truckId)!
    truck.fuel = truck.fuel.plus(amount)
    fuel = fuel.plus(amount)
  })
  const truckRows = [...byTruck.values()].sort((a, b) => compare(a.plate, b.plate) || compare(a.id, b.id)).map(truck => ({ id: truck.id, plate: truck.plate, operationalDays: truck.dates.size, equivalentDays: equivalent(truck.shares), fuelExpense: truck.fuel.toFixed(2) }))
  const workerRows = [...workers.values()].sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id)).map(worker => ({ id: worker.id, name: worker.name, days: worker.dates.size, equivalentDays: equivalent(worker.shares) }))
  const labels = { month: 'Mes', quarter: 'Trimestre', 'half-year': 'Semestre', year: 'Año' }
  return { month, period, periodLabel: `${labels[period]}: ${civilStart.toISOString().slice(0, 10)} – ${new Date(civilEnd.getTime() - 86400000).toISOString().slice(0, 10)}`,
    trucks: truckRows, workers: workerRows,
    companies: [...companies.values()].sort((a, b) => compare(a.name, b.name)).map(company => ({ name: company.name, truckDays: company.truckDates.size, workerDays: company.workerDates.size, equivalentDays: equivalent(company.shares) })),
    totals: { truckDays: truckRows.reduce((sum, truck) => sum + truck.operationalDays, 0), calendarDays: calendar.size, workerDays: workerRows.reduce((sum, worker) => sum + worker.days, 0), equivalentDays: equivalent(shares), fuelExpense: fuel.toFixed(2) },
  }
}
