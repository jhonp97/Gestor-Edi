import { expect, it } from 'vitest'
import { resolveTruckStatisticsPeriod as resolve, truckStatisticsQuery } from '@/lib/truck-statistics-period'
it('defaults at Madrid month boundary, not UTC month', () => {
  const p = resolve({}, new Date('2026-03-31T22:30:00Z'))
  expect(p.month).toBe('2026-04')
  expect(p.date?.gte.toISOString()).toBe('2026-03-31T22:00:00.000Z')
})
it.each([
  ['2026-03-29', '2026-03-29', 23],
  ['2026-10-25', '2026-10-25', 25],
  ['2026-03-28', '2026-03-30', 71],
])('includes civil days DST-safely %s to %s', (from, to, hours) => {
  const p = resolve({ statsPeriod: 'range', statsFrom: from, statsTo: to })
  expect((p.date!.lt.getTime() - p.date!.gte.getTime()) / 3600000).toBe(hours)
  expect(truckStatisticsQuery(p)).toEqual({ statsPeriod: 'range', statsFrom: from, statsTo: to })
})
it('month crosses year boundary; all has no date or stale query values', () => {
  const p = resolve({ statsPeriod: 'month', statsMonth: '2199-12' })
  expect(p.date!.lt.toISOString()).toBe('2199-12-31T23:00:00.000Z')
  const all = resolve({ statsPeriod: 'all', statsMonth: ['bad', 'bad'] })
  expect(all.date).toBeUndefined()
  expect(truckStatisticsQuery(all)).toEqual({ statsPeriod: 'all' })
})
it.each([
  { statsPeriod: ['all', 'all'] }, { statsPeriod: 'unknown' },
  { statsPeriod: 'month', statsMonth: ['2026-01'] }, { statsPeriod: 'month', statsMonth: '2200-01' },
  { statsPeriod: 'month', statsMonth: '2026-13' }, { statsPeriod: 'month' },
  { statsPeriod: 'range', statsFrom: '2026-02-30', statsTo: '2026-03-01' },
  { statsPeriod: 'range', statsFrom: '2026-03-02', statsTo: '2026-03-01' },
  { statsPeriod: 'range', statsFrom: ['2026-03-01'], statsTo: '2026-03-01' },
  { statsPeriod: 'range', statsFrom: '1899-12-31', statsTo: '2026-03-01' },
])('rejects malformed active values %j', query => expect(() => resolve(query)).toThrow())
