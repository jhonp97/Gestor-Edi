// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), session: vi.fn(), decrypt: vi.fn(), render: vi.fn(), workerRepository: vi.fn() }))
vi.mock('@/repositories/worker.repository', () => ({
  WorkerRepository: vi.fn(function (organizationId: string) {
    mocks.workerRepository(organizationId)
  }),
}))
vi.mock('@/lib/prisma', () => ({ prisma: { payroll: { findFirst: mocks.findFirst } } }))
vi.mock('@/lib/session', () => ({ getSessionUniversal: mocks.session }))
vi.mock('@/services/encryption.service', () => ({ getEncryptionService: () => ({ decryptWorkerDni: mocks.decrypt }) }))
vi.mock('@react-pdf/renderer', () => ({ renderToBuffer: mocks.render, StyleSheet: { create: (styles: unknown) => styles } }))
import { GET } from '@/app/api/nomina/[id]/pdf/route'
import { NominaDocument } from '@/lib/pdf/nomina-document'

const source = { id: 'payroll-test', month: 3, year: 2026, grossPay: 120, netPay: 100, paidAt: new Date('2026-03-01'), worker: { name: 'Synthetic Worker', dni: 'synthetic:encrypted', position: 'Driver' } }
const request = () => GET(new NextRequest('http://localhost/api/nomina/payroll-test/pdf'), { params: Promise.resolve({ id: source.id }) })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { organizationId: 'org-test' } })
  mocks.findFirst.mockResolvedValue(source)
  mocks.decrypt.mockResolvedValue('X0000000T')
  mocks.render.mockResolvedValue(Buffer.from('synthetic-pdf'))
})

it('passes decrypted immutable payroll to the real document render input', async () => {
  const response = await request()
  expect(response.status).toBe(200)
  expect(mocks.workerRepository).toHaveBeenCalledWith('org-test')
  expect(response.headers.get('Content-Type')).toBe('application/pdf')
  const element = mocks.render.mock.calls[0][0]
  expect(element.type).toBe(NominaDocument)
  expect(element.props.payroll).toEqual({ ...source, paidAt: source.paidAt.toISOString(), worker: { ...source.worker, dni: 'X0000000T' } })
  expect(source.worker.dni).toBe('synthetic:encrypted')
  expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: source.id, organizationId: 'org-test' }, include: { worker: true } })
})

it.each([null, { user: {} }, { user: { organizationId: '' } }])('denies missing session organization before lookup, decrypt or render', async (session) => {
  mocks.session.mockResolvedValue(session)
  expect((await request()).status).toBe(401)
  expect(mocks.workerRepository).not.toHaveBeenCalled()
  expect(mocks.findFirst).not.toHaveBeenCalled()
  expect(mocks.decrypt).not.toHaveBeenCalled()
  expect(mocks.render).not.toHaveBeenCalled()
})

it('returns 404 for a missing or out-of-tenant payroll without decrypting or rendering', async () => {
  mocks.findFirst.mockResolvedValue(null)
  expect((await request()).status).toBe(404)
  expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: source.id, organizationId: 'org-test' } }))
  expect(mocks.decrypt).not.toHaveBeenCalled()
  expect(mocks.render).not.toHaveBeenCalled()
})

it.each(['00000000T', '', null])('passes safe legacy or missing identity to PDF %s', async (dni) => {
  mocks.findFirst.mockResolvedValue({ ...source, worker: { ...source.worker, dni } })
  await request()
  expect(mocks.render.mock.calls[0][0].props.payroll.worker.dni).toBe(dni ?? '')
  expect(mocks.decrypt).not.toHaveBeenCalled()
})

it('uses empty PDF identity on decryption failure', async () => {
  mocks.decrypt.mockRejectedValue(new Error('Invalid ciphertext'))
  await request()
  expect(mocks.render.mock.calls[0][0].props.payroll.worker.dni).toBe('')
})
