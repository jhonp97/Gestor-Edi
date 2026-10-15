import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/lib/auth-edge', () => ({ getUserFromRequest: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction, truck: { findFirst: async () => ({ id: 'target' }), delete: async () => { throw { code: 'P2003' } } } } }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
import { DELETE } from '@/app/api/trucks/[id]/route'

let state: { trucks: string[]; segments: { truckId: string; organizationId: string; share: number }[]; days: number[]; payroll: number[]; rates: number[] }
let writes: number
let fail: boolean
let linkReads: number
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ organizationId: 'org' })
  state = { trucks: ['target', 'other'], segments: [
    { truckId: 'target', organizationId: 'org', share: 40 },
    { truckId: 'other', organizationId: 'org', share: 60 },
  ], days: [100], payroll: [100], rates: [100] }
  writes = 0; linkReads = 0; fail = false
  mocks.transaction.mockImplementation(async (callback) => {
    const draft = structuredClone(state)
    const tx = {
      truck: {
        findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
          where.organizationId === 'org' && draft.trucks.includes(where.id) ? { id: where.id } : null,
        delete: async ({ where }: { where: { id: string } }) => {
          writes++
          if (fail) throw { code: 'P2003', message: 'private database detail' }
          draft.trucks = draft.trucks.filter(id => id !== where.id)
        },
      },
      workerDayTruckSegment: {
        count: async ({ where }: { where: { truckId: string; organizationId: string } }) => {
          linkReads++
          return draft.segments.filter(s => s.truckId === where.truckId && s.organizationId === where.organizationId).length
        },
        deleteMany: async ({ where }: { where: { truckId: string; organizationId: string } }) => {
          writes++
          draft.segments = draft.segments.filter(s => s.truckId !== where.truckId || s.organizationId !== where.organizationId)
        },
      },
    }
    const result = await callback(tx)
    state = draft
    return result
  })
})
const remove = (body?: string, id = 'target') => DELETE(new Request('http://localhost/api/trucks/' + id, {
  method: 'DELETE', ...(body === undefined ? {} : { body }),
}), { params: Promise.resolve({ id }) })

describe('truck history deletion public route', () => {
  it.each([undefined, '{}', '{"confirmHistoryDeletion":false}'])('requires explicit confirmation: %s', async body => {
    const before = structuredClone(state)
    expect((await remove(body)).status).toBe(409)
    expect(state).toEqual(before); expect(writes).toBe(0)
  })
  it.each(['{', '{"confirmHistoryDeletion":"true"}', '{"confirmHistoryDeletion":null}', 'null', '[]'])('rejects invalid input: %s', async body => {
    const before = structuredClone(state)
    expect((await remove(body)).status).toBe(400)
    expect(state).toEqual(before); expect(writes).toBe(0)
  })
  it('preserves other shares and employee pay records', async () => {
    expect((await remove('{"confirmHistoryDeletion":true}')).status).toBe(200)
    expect(state).toEqual({ trucks: ['other'], segments: [{ truckId: 'other', organizationId: 'org', share: 60 }], days: [100], payroll: [100], rates: [100] })
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
  it('rolls back segment deletion on a concurrent FK conflict without exposing details', async () => {
    fail = true
    const before = structuredClone(state)
    const response = await remove('{"confirmHistoryDeletion":true}')
    expect(response.status).toBe(409)
    expect(await response.text()).not.toContain('private')
    expect(state).toEqual(before); expect(writes).toBe(2)
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it('allows the legacy empty-body deletion without history', async () => {
    state.segments = []
    expect((await remove()).status).toBe(200)
    expect(state.trucks).toEqual(['other'])
  })
  it('does not read links or mutate a foreign truck', async () => {
    mocks.auth.mockResolvedValue({ organizationId: 'foreign' })
    const before = structuredClone(state)
    expect((await remove('{"confirmHistoryDeletion":true}')).status).toBe(404)
    expect(state).toEqual(before); expect(linkReads).toBe(0); expect(writes).toBe(0)
  })
  it('rejects unauthenticated requests without database access', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await remove()).status).toBe(401)
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(writes).toBe(0)
  })
})
