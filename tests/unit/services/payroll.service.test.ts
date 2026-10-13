// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { PayrollService } from '@/services/payroll.service'
import type { PayrollRepository } from '@/repositories/payroll.repository'
import type { WorkerRepository } from '@/repositories/worker.repository'
const worker = { id: '11111111-1111-4111-8111-111111111111', baseSalary: 1000 }
const repo = { findByWorkerAndPeriod: vi.fn(), create: vi.fn(), findById: vi.fn(), markAsPaid: vi.fn() }
const workers = { findActive: vi.fn() }
const service = new PayrollService(repo as unknown as PayrollRepository, workers as unknown as WorkerRepository)
beforeEach(() => {
  vi.resetAllMocks()
  repo.findByWorkerAndPeriod.mockResolvedValue({ id: 'old', paidAt: null })
  repo.create.mockImplementation(async (data) => ({ id: 'new', ...data }))
  repo.findById.mockResolvedValue({ id: 'new', worker })
  workers.findActive.mockResolvedValue([worker])
})
it('service permits regeneration of pending monthly payrolls with previous deductions', async () => {
  const result = await service.generateMonthlyPayroll(3, 2026)
  expect(result).toHaveLength(1)
  expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ month: 3, year: 2026, irpfAmount: 150, socialSecurityAmount: 63.5, netPay: 786.5 }))
})
it('service accepts explicit cross-year dates and manual salary without pending blocking', async () => {
  await service.create({ workerId: worker.id, month: 3, year: 2026, baseSalary: 1000, irpfPercent: 10, periodStart: '2025-12-15', periodEnd: '2026-01-14' } as Parameters<typeof service.create>[0])
  expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ month: 12, year: 2025, periodStart: new Date('2025-12-15'), periodEnd: new Date('2026-01-14'), baseSalary: 1000, netPay: 900 }))
})
it('service preserves manual monthly salary and zero default social security', async () => {
  repo.findByWorkerAndPeriod.mockResolvedValue(null)
  await service.create({ workerId: worker.id, month: 2, year: 2026, baseSalary: 1000, irpfPercent: 0 })
  expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ periodStart: new Date('2026-02-01'), periodEnd: new Date('2026-02-28'), baseSalary: 1000, netPay: 1000, socialSecurityPercent: 0 }))
})
