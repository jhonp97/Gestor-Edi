import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PayrollTable } from '@/components/nomina/payroll-table'
import { PayrollCard } from '@/components/nomina/payroll-card'
import type { PayrollWithWorker } from '@/types'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const payroll = { id: 'p', month: 12, year: 2025, baseSalary: 100, irpfPercent: 0, irpfAmount: 0, socialSecurityPercent: 0, socialSecurityAmount: 0, otherDeductions: 0, grossPay: 100, netPay: 100, paidAt: null, worker: { name: 'Ana', dni: 'Synthetic', position: 'Driver' }, periodStart: new Date('2025-12-15'), periodEnd: new Date('2026-01-14') }
it('desktop and mobile list identify the saved cross-year period', () => {
  render(<PayrollTable payrolls={[payroll as unknown as PayrollWithWorker]} />)
  expect(screen.getAllByText('Del 15/12/2025 al 14/01/2026')).toHaveLength(2)
  expect(screen.getAllByText('Pendiente')).toHaveLength(2)
})
it('card identifies legacy monthly dates without changing payment status', () => {
  render(<PayrollCard {...payroll} workerName="Ana" workerDni="Synthetic" position="Driver" ssAmount={0} periodStart={null} periodEnd={null} />)
  expect(screen.getByText('Del 01/12/2025 al 31/12/2025')).toBeInTheDocument()
  expect(screen.getByText('Pendiente')).toBeInTheDocument()
})
