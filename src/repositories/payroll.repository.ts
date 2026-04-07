import { BaseRepository } from './base.repository'
import type { Payroll, PayrollWithWorker, MonthlyPayrollSummary } from '@/types'

export class PayrollRepository extends BaseRepository {
  async findAll(): Promise<Payroll[]> {
    return this.prisma.payroll.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
  }

  async findById(id: string): Promise<PayrollWithWorker | null> {
    return this.prisma.payroll.findUnique({
      where: { id },
      include: { worker: true },
    })
  }

  async findByMonthYear(month: number, year: number): Promise<PayrollWithWorker[]> {
    return this.prisma.payroll.findMany({
      where: { month, year },
      include: { worker: true },
      orderBy: { worker: { name: 'asc' } },
    })
  }

  async findByWorkerId(workerId: string): Promise<Payroll[]> {
    return this.prisma.payroll.findMany({
      where: { workerId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
  }

  async findByWorkerAndPeriod(
    workerId: string,
    month: number,
    year: number,
  ): Promise<Payroll | null> {
    return this.prisma.payroll.findUnique({
      where: {
        workerId_month_year: { workerId, month, year },
      },
    })
  }

  async create(data: {
    workerId: string
    month: number
    year: number
    baseSalary: number
    irpfPercent: number
    irpfAmount: number
    socialSecurityPercent: number
    socialSecurityAmount: number
    bonuses?: number
    bonusesDesc?: string | null
    otherDeductions: number
    otherDeductionsDesc?: string | null
    grossPay: number
    netPay: number
    notes?: string
  }): Promise<Payroll> {
    return this.prisma.payroll.create({
      data,
    })
  }

  async update(
    id: string,
    data: Partial<{
      irpfPercent: number
      irpfAmount: number
      socialSecurityPercent: number
      socialSecurityAmount: number
      otherDeductions: number
      otherDeductionsDesc: string
      notes: string
      grossPay: number
      netPay: number
    }>,
  ): Promise<Payroll> {
    return this.prisma.payroll.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<Payroll> {
    return this.prisma.payroll.delete({
      where: { id },
    })
  }

  async markAsPaid(id: string, paidAt: Date): Promise<Payroll> {
    return this.prisma.payroll.update({
      where: { id },
      data: { paidAt },
    })
  }

  async getMonthlySummary(month: number, year: number): Promise<MonthlyPayrollSummary> {
    const payrolls = await this.prisma.payroll.findMany({
      where: { month, year },
      select: {
        grossPay: true,
        netPay: true,
        workerId: true,
      },
    })

    const totalGross = payrolls.reduce((sum, p) => sum + p.grossPay, 0)
    const totalNet = payrolls.reduce((sum, p) => sum + p.netPay, 0)
    const uniqueWorkers = new Set(payrolls.map((p) => p.workerId))

    return {
      totalGross: Math.round(totalGross * 100) / 100,
      totalDeductions: Math.round((totalGross - totalNet) * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      workerCount: uniqueWorkers.size,
    }
  }
}
