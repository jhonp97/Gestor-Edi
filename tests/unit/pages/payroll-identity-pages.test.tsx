// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn(), aggregate: vi.fn(), session: vi.fn(), decrypt: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { payroll: mocks } }))
vi.mock('@/lib/session', () => ({ getSessionUniversal: mocks.session }))
vi.mock('@/services/encryption.service', () => ({ getEncryptionService: () => ({ decryptWorkerDni: mocks.decrypt }) }))
vi.mock('@/components/nomina/payroll-table', () => ({ PayrollTable: ({ payrolls }: { payrolls: { worker: { dni: string } }[] }) => <div>{payrolls[0].worker.dni}</div> }))
vi.mock('@/components/nomina/payroll-individual-dialog', () => ({ PayrollIndividualDialog: () => null }))
vi.mock('@/components/nomina/payroll-breakdown', () => ({ PayrollBreakdown: () => null }))
vi.mock('@/components/nomina/mark-as-paid-button', () => ({ MarkAsPaidButton: () => null }))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('redirect') }, notFound: () => { throw new Error('notFound') } }))
import PayrollPage from '@/app/(app)/nomina/page'
import PayrollDetailPage from '@/app/(app)/nomina/[id]/page'

const source = { id: 'payroll-test', month: 3, year: 2026, createdAt: new Date('2026-03-01'), paidAt: null, worker: { name: 'Synthetic Worker', dni: 'synthetic:encrypted', position: 'Driver' } }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { organizationId: 'org-test' } })
  mocks.findMany.mockResolvedValue([source])
  mocks.findFirst.mockResolvedValue(source)
  mocks.aggregate.mockResolvedValue({ _sum: {}, _count: { workerId: 1 } })
  mocks.decrypt.mockResolvedValue('00000000T')
})

it('passes decrypted identity to list client props while retaining tenant scope', async () => {
  const html = renderToStaticMarkup(await PayrollPage({ searchParams: Promise.resolve({ month: '3', year: '2026' }) }))
  expect(html).toContain('00000000T')
  expect(html).not.toContain(source.worker.dni)
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { month: 3, year: 2026, organizationId: 'org-test' } }))
  expect(source.worker.dni).toBe('synthetic:encrypted')
})

it('renders decrypted detail identity within the session organization', async () => {
  const html = renderToStaticMarkup(await PayrollDetailPage({ params: Promise.resolve({ id: source.id }) }))
  expect(html).toContain('00000000T')
  expect(html).not.toContain(source.worker.dni)
  expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: source.id, organizationId: 'org-test' } }))
})

it('does not render failed decryption ciphertext on either page', async () => {
  mocks.decrypt.mockRejectedValue(new Error('Invalid ciphertext'))
  expect(renderToStaticMarkup(await PayrollPage({ searchParams: Promise.resolve({}) }))).not.toContain(source.worker.dni)
  expect(renderToStaticMarkup(await PayrollDetailPage({ params: Promise.resolve({ id: source.id }) }))).not.toContain(source.worker.dni)
})

it.each(['X0000000T', '', null])('preserves safe legacy or missing identity on both pages %s', async (dni) => {
  const payroll = { ...source, worker: { ...source.worker, dni } }
  mocks.findMany.mockResolvedValue([payroll])
  mocks.findFirst.mockResolvedValue(payroll)
  const list = renderToStaticMarkup(await PayrollPage({ searchParams: Promise.resolve({}) }))
  const detail = renderToStaticMarkup(await PayrollDetailPage({ params: Promise.resolve({ id: source.id }) }))
  if (dni) {
    expect(list).toContain(dni)
    expect(detail).toContain(dni)
  }
  expect(list).not.toContain(source.worker.dni)
  expect(detail).not.toContain(source.worker.dni)
  expect(mocks.decrypt).not.toHaveBeenCalled()
})

it('preserves redirect and notFound behavior', async () => {
  mocks.session.mockResolvedValue(null)
  await expect(PayrollPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect')
  await expect(PayrollDetailPage({ params: Promise.resolve({ id: source.id }) })).rejects.toThrow('redirect')
  expect(mocks.findFirst).not.toHaveBeenCalled()
  mocks.session.mockResolvedValue({ user: { organizationId: 'org-test' } })
  mocks.findFirst.mockResolvedValue(null)
  await expect(PayrollDetailPage({ params: Promise.resolve({ id: source.id }) })).rejects.toThrow('notFound')
})
