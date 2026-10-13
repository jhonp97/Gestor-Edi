// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ payroll: { findFirst: vi.fn(), findMany: vi.fn(), delete: vi.fn(), update: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/auth-edge', () => ({ getUserFromRequest: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { DELETE } from '@/app/api/payroll/[id]/route'
import { GET } from '@/app/api/payroll/route'
import { PayrollRepository } from '@/repositories/payroll.repository'
const pending = { id: 'p', organizationId: 'org', workerId: 'w', month: 3, year: 2026, paidAt: null as Date | null }
let stored: typeof pending[]
const invoke = (id = 'p') => DELETE(new Request('http://localhost/api/payroll/p', { method: 'DELETE' }), { params: Promise.resolve({ id }) })
const list = async () => (await GET(new Request('http://localhost/api/payroll'))).json()
beforeEach(() => {
  vi.resetAllMocks()
  stored = [{ ...pending }]
  vi.mocked(getUserFromRequest).mockResolvedValue({ organizationId: 'org' } as never)
  db.payroll.findFirst.mockImplementation(async ({ where }) => stored.find(p => p.id === where.id && p.organizationId === where.organizationId) ?? null)
  db.payroll.findMany.mockImplementation(async ({ where }) => stored.filter(p => p.organizationId === where.organizationId))
  db.payroll.delete.mockImplementation(async ({ where }) => {
    const index = stored.findIndex(p => p.id === where.id && p.organizationId === where.organizationId && p.paidAt === where.paidAt)
    if (index < 0) throw { code: 'P2025' }
    return stored.splice(index, 1)[0]
  })
  db.$transaction.mockImplementation(async (action) => action(db))
  db.$queryRaw.mockResolvedValue([{ id: 'w' }])
})
it('deletes only the requested pending document and refreshes payroll views', async () => {
  stored.push({ ...pending, id: 'keep' })
  const response = await invoke()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ success: true })
  expect(await list()).toEqual([{ ...pending, id: 'keep' }])
  expect(db.payroll.delete).toHaveBeenCalledWith({ where: { id: 'p', organizationId: 'org', paidAt: null } })
  expect(db.$transaction).toHaveBeenCalled()
  expect(db.$queryRaw).toHaveBeenCalled()
  expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.payroll.delete.mock.invocationCallOrder[0])
  expect(revalidatePath).toHaveBeenCalledWith('/nomina')
  expect(revalidatePath).toHaveBeenCalledWith('/workers/w')
})
it('paid documents are rejected and remain unchanged in the public listing', async () => {
  stored[0].paidAt = new Date('2026-03-20')
  const before = await list()
  const response = await invoke()
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ error: 'No se puede eliminar una nómina pagada' })
  expect(await list()).toEqual(before)
  expect(db.payroll.delete).not.toHaveBeenCalled()
  expect(db.payroll.update).not.toHaveBeenCalled()
  expect(revalidatePath).not.toHaveBeenCalled()
})
it('rechecks paid state after acquiring the same worker lock as payment', async () => {
  db.$queryRaw.mockImplementation(async () => { stored[0].paidAt = new Date('2026-03-20'); return [{ id: 'w' }] })
  const response = await invoke()
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ error: 'No se puede eliminar una nómina pagada' })
  expect(await list()).toEqual([{ ...pending, paidAt: '2026-03-20T00:00:00.000Z' }])
  expect(db.payroll.delete).not.toHaveBeenCalled()
})
it('missing and foreign documents are indistinguishable and leave stored rows untouched', async () => {
  const before = await list()
  const missing = await invoke('missing')
  expect(missing.status).toBe(404)
  expect(await missing.json()).toEqual({ error: 'Nómina no encontrada' })
  vi.mocked(getUserFromRequest).mockResolvedValue({ organizationId: 'other' } as never)
  const foreign = await invoke()
  expect(foreign.status).toBe(404)
  expect(await foreign.json()).toEqual({ error: 'Nómina no encontrada' })
  vi.mocked(getUserFromRequest).mockResolvedValue({ organizationId: 'org' } as never)
  expect(await list()).toEqual(before)
  expect(db.payroll.delete).not.toHaveBeenCalled()
})
it.each([null, { organizationId: '' }])('requires authenticated organization before reading or writing: %j', async (user) => {
  vi.mocked(getUserFromRequest).mockResolvedValue(user as never)
  const response = await invoke()
  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({ error: 'Unauthorized' })
  expect(db.payroll.findFirst).not.toHaveBeenCalled()
  expect(db.payroll.delete).not.toHaveBeenCalled()
})
it('rejects empty id without reading or writing', async () => {
  const response = await invoke('')
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: 'ID requerido' })
  expect(db.payroll.findFirst).not.toHaveBeenCalled()
  expect(db.payroll.delete).not.toHaveBeenCalled()
})
it('two deletion requests remove the document only once', async () => {
  expect((await invoke()).status).toBe(200)
  const repeated = await invoke()
  expect(repeated.status).toBe(404)
  expect(await repeated.json()).toEqual({ error: 'Nómina no encontrada' })
  expect(await list()).toEqual([])
  expect(db.payroll.delete).toHaveBeenCalledTimes(1)
})
it('unexpected database failures return a sanitized error without mutation', async () => {
  db.payroll.findFirst.mockRejectedValue(new Error('private database detail'))
  const response = await invoke()
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: 'Error al eliminar la nómina' })
  expect(await list()).toEqual([pending])
  expect(db.payroll.delete).not.toHaveBeenCalled()
})
it('repository deletion cannot bypass the pending-only rule', async () => {
  stored[0].paidAt = new Date('2026-03-20')
  const repo = new PayrollRepository('org')
  await expect(repo.delete('p')).rejects.toThrow('No se puede eliminar una nómina pagada')
  expect(db.payroll.delete).not.toHaveBeenCalled()
  expect(await list()).toEqual([{ ...pending, paidAt: '2026-03-20T00:00:00.000Z' }])
})
