export type TruckStatisticsPeriod = {
  mode: 'current' | 'month' | 'all' | 'range'
  month: string
  from: string
  to: string
  label: string
  date?: { gte: Date; lt: Date }
}

const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
function parts(date: Date) {
  return Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, Number(part.value)]))
}
function midnight(civil: Date) {
  const target = civil.getTime()
  let instant = target
  // Convert each civil midnight independently, rather than adding 24 hours across DST.
  for (let step = 0; step < 3; step++) {
    const p = parts(new Date(instant))
    instant += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  }
  return new Date(instant)
}
function civilDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^(19|20|21)\d\d-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid statistics date')
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Invalid statistics date')
  return date
}
export function resolveTruckStatisticsPeriod(query: Record<string, string | string[] | undefined>, now = new Date()): TruckStatisticsPeriod {
  const p = parts(now)
  const current = `${p.year}-${String(p.month).padStart(2, '0')}`
  const mode = query.statsPeriod ?? 'current'
  if (mode !== 'current' && mode !== 'month' && mode !== 'all' && mode !== 'range') throw new Error('Invalid statistics period')
  const result: TruckStatisticsPeriod = { mode, month: current, from: '', to: '', label: 'Mes actual' }
  if (mode === 'all') return { ...result, label: 'Total histórico' }
  if (mode === 'range') {
    const start = civilDate(query.statsFrom)
    const end = civilDate(query.statsTo)
    if (start > end) throw new Error('Reversed statistics dates')
    end.setUTCDate(end.getUTCDate() + 1)
    return { ...result, from: query.statsFrom as string, to: query.statsTo as string, label: `${query.statsFrom} – ${query.statsTo}`, date: { gte: midnight(start), lt: midnight(end) } }
  }
  if (mode === 'month') {
    if (typeof query.statsMonth !== 'string' || !/^(19|20|21)\d\d-(0[1-9]|1[0-2])$/.test(query.statsMonth)) throw new Error('Invalid statistics month')
    result.month = query.statsMonth
    result.label = `Mes elegido: ${result.month}`
  } else result.label = `Mes actual: ${current}`
  const [year, month] = result.month.split('-').map(Number)
  result.date = { gte: midnight(new Date(Date.UTC(year, month - 1, 1))), lt: midnight(new Date(Date.UTC(year, month, 1))) }
  return result
}
export function truckStatisticsQuery(period: TruckStatisticsPeriod): Record<string, string> {
  return { statsPeriod: period.mode, ...(period.mode === 'month' ? { statsMonth: period.month } : {}), ...(period.mode === 'range' ? { statsFrom: period.from, statsTo: period.to } : {}) }
}
