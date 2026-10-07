import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth-edge', () => ({ getUserFromRequest: vi.fn().mockResolvedValue(null) }))
import { getUserFromRequest } from '@/lib/auth-edge'
import { WorkerDayOperationService } from '@/services/worker-day-operation.service'
import { GET, PUT } from '@/app/api/workers/[id]/operations/days/[date]/route'

const context = { params: Promise.resolve({ id: 'worker', date: '2026-09-03' }) }

describe('operational day route authentication', () => {
  afterEach(() => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null)
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated reads and writes before database access', async () => {
    const get = await GET(new Request('http://localhost/'), context)
    const put = await PUT(new Request('http://localhost/', { method: 'PUT', body: '{}' }), context)
    expect(get.status).toBe(401)
    expect(put.status).toBe(401)
  })

  it('reports an unmigrated schema without exposing database error details', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue({ organizationId: 'tenant-a' } as never)
    vi.spyOn(WorkerDayOperationService.prototype, 'put').mockRejectedValue(Object.assign(new Error('private connection details'), { code: 'P2022' }))
    const request = new Request('http://localhost/', {
      method: 'PUT',
      body: JSON.stringify({ companyName: 'Acme', segments: [{ truckId: '11111111-1111-4111-8111-111111111111', kilometers: 180 }] }),
    })
    const result = await PUT(request, context)
    expect(result.status).toBe(503)
    expect(await result.json()).toEqual({ error: 'Falta actualizar el esquema de la base de datos antes de guardar esta jornada' })
  })
})
