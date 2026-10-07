import { describe, expect, it } from 'vitest'
import { workerDayOperationSchema } from '@/schemas/worker-day-operation.schema'

const truck = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const companyName = 'Transportes del Sur'

describe('worker day operation input', () => {
  it('defaults one truck to 100 and two trucks to 50/50', () => {
    expect(workerDayOperationSchema.parse({ companyName, segments: [{ truckId: truck }] }).segments[0].share).toBe(100)
    expect(workerDayOperationSchema.parse({ companyName, segments: [{ truckId: truck, incident: 'Engine failed' }, { truckId: other }] }).segments.map(s => s.share)).toEqual([50, 50])
  })
  it('requires a meaningful incident on the first truck only for replacement days', () => {
    expect(workerDayOperationSchema.safeParse({ companyName, segments: [{ truckId: truck }] }).success).toBe(true)
    for (const incident of [undefined, ' ', '  ']) {
      expect(workerDayOperationSchema.safeParse({ companyName, segments: [{ truckId: truck, incident }, { truckId: other }] }).success).toBe(false)
    }
    expect(workerDayOperationSchema.safeParse({ companyName, segments: [{ truckId: truck }, { truckId: other, incident: 'Engine failed' }] }).success).toBe(false)
    expect(workerDayOperationSchema.safeParse({ companyName, segments: [{ truckId: truck, incident: 'Engine failed' }, { truckId: other }] }).success).toBe(true)
  })
  it('rejects duplicate trucks, invalid allocation and unbounded distance', () => {
    for (const segments of [[{ truckId: truck }, { truckId: truck }], [{ truckId: truck, share: 60 }, { truckId: other, share: 30 }], [{ truckId: truck, kilometers: -1 }]]) {
      expect(workerDayOperationSchema.safeParse({ companyName, segments }).success).toBe(false)
    }
  })
  it('requires a bounded company name rather than a nonexistent company identifier', () => {
    expect(workerDayOperationSchema.safeParse({ companyName: ' ', segments: [{ truckId: truck }] }).success).toBe(false)
    expect(workerDayOperationSchema.safeParse({ companyId: truck, segments: [{ truckId: truck }] }).success).toBe(false)
  })
})
