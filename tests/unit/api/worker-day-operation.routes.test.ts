import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth-edge', () => ({ getUserFromRequest: vi.fn().mockResolvedValue(null) }))
import { GET, PUT } from '@/app/api/workers/[id]/operations/days/[date]/route'

const context = { params: Promise.resolve({ id: 'worker', date: '2026-09-03' }) }

describe('operational day route authentication', () => {
  it('rejects unauthenticated reads and writes before database access', async () => {
    const get = await GET(new Request('http://localhost/'), context)
    const put = await PUT(new Request('http://localhost/', { method: 'PUT', body: '{}' }), context)
    expect(get.status).toBe(401)
    expect(put.status).toBe(401)
  })
})
