// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { decrypt } = vi.hoisted(() => ({ decrypt: vi.fn() }))
vi.mock('@/services/encryption.service', () => ({
  getEncryptionService: () => ({ decryptWorkerDni: decrypt }),
}))
import { mapPayrollWorkerIdentity } from '@/lib/payroll-worker-identity'

beforeEach(() => vi.resetAllMocks())

it('decrypts a synthetic identity without changing the source or other data', async () => {
  const source = { grossPay: 120, worker: { name: 'Synthetic Worker', dni: 'synthetic:encrypted' } }
  decrypt.mockResolvedValue('X0000000T')
  const result = await mapPayrollWorkerIdentity(source)
  expect(result).toEqual({ ...source, worker: { ...source.worker, dni: 'X0000000T' } })
  expect(source.worker.dni).toBe('synthetic:encrypted')
  expect(result).not.toBe(source)
  expect(result.worker).not.toBe(source.worker)
})

it.each(['00000000T', '', null])('preserves safe legacy or missing identity %s', async (dni) => {
  expect((await mapPayrollWorkerIdentity({ worker: { dni } })).worker.dni).toBe(dni ?? '')
  expect(decrypt).not.toHaveBeenCalled()
})

it('never falls back to ciphertext when decryption rejects', async () => {
  decrypt.mockRejectedValue(new Error('Invalid ciphertext'))
  expect((await mapPayrollWorkerIdentity({ worker: { dni: 'invalid:encrypted' } })).worker.dni).toBe('')
})
