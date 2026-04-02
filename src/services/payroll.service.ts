import { PayrollRepository } from '@/repositories/payroll.repository'
import { WorkerRepository } from '@/repositories/worker.repository'
import { createPayrollSchema, generatePayrollSchema } from '@/schemas'
import type {
  PayrollWithWorker,
  MonthlyPayrollSummary,
  PayrollCalculation,
} from '@/types'

export class PayrollService {
  constructor(
    private repo: PayrollRepository,
    private workerRepo: WorkerRepository,
  ) {}

  calculatePayroll(
    baseSalary: number,
    irpfPercent: number,
    ssPercent: number = 6.35,
    otherDeductions: number = 0,
  ): PayrollCalculation {
    const irpfAmount = baseSalary * (irpfPercent / 100)
    const socialSecurityAmount = baseSalary * (ssPercent / 100)
    const grossPay = baseSalary
    const netPay = grossPay - irpfAmount - socialSecurityAmount - otherDeductions

    return {
      baseSalary,
      irpfPercent,
      irpfAmount: Math.round(irpfAmount * 100) / 100,
      socialSecurityPercent: ssPercent,
      socialSecurityAmount: Math.round(socialSecurityAmount * 100) / 100,
      otherDeductions,
      grossPay: Math.round(grossPay * 100) / 100,
      netPay: Math.round(netPay * 100) / 100,
    }
  }

  async generateMonthlyPayroll(
    month: number,
    year: number,
    irpfPercent: number = 15,
  ): Promise<PayrollWithWorker[]> {
    const validated = generatePayrollSchema.parse({ month, year, irpfPercent })

    const activeWorkers = await this.workerRepo.findActive()
    const created: PayrollWithWorker[] = []

    for (const worker of activeWorkers) {
      const existing = await this.repo.findByWorkerAndPeriod(
        worker.id,
        validated.month,
        validated.year,
      )
      if (existing) continue

      const calc = this.calculatePayroll(
        worker.baseSalary,
        validated.irpfPercent,
      )

      const payroll = await this.repo.create({
        workerId: worker.id,
        month: validated.month,
        year: validated.year,
        baseSalary: calc.baseSalary,
        irpfPercent: calc.irpfPercent,
        irpfAmount: calc.irpfAmount,
        socialSecurityPercent: calc.socialSecurityPercent,
        socialSecurityAmount: calc.socialSecurityAmount,
        otherDeductions: calc.otherDeductions,
        grossPay: calc.grossPay,
        netPay: calc.netPay,
      })

      created.push({ ...payroll, worker })
    }

    return created
  }

  async getMonthlySummary(
    month: number,
    year: number,
  ): Promise<MonthlyPayrollSummary> {
    return this.repo.getMonthlySummary(month, year)
  }

  async getAll(filters?: {
    month?: number
    year?: number
    workerId?: string
  }): Promise<PayrollWithWorker[]> {
    if (filters?.month && filters?.year) {
      return this.repo.findByMonthYear(filters.month, filters.year)
    }

    if (filters?.workerId) {
      const payrolls = await this.repo.findByWorkerId(filters.workerId)
      // Enrich with worker data
      const enriched: PayrollWithWorker[] = []
      for (const p of payrolls) {
        const withWorker = await this.repo.findById(p.id)
        if (withWorker) enriched.push(withWorker)
      }
      return enriched
    }

    // Return all with worker relation
    const all = await this.repo.findAll()
    const enriched: PayrollWithWorker[] = []
    for (const p of all) {
      const withWorker = await this.repo.findById(p.id)
      if (withWorker) enriched.push(withWorker)
    }
    return enriched
  }

  async getById(id: string): Promise<PayrollWithWorker | null> {
    return this.repo.findById(id)
  }

  async markAsPaid(id: string): Promise<PayrollWithWorker> {
    await this.repo.markAsPaid(id, new Date())
    const withWorker = await this.repo.findById(id)
    if (!withWorker) throw new Error('Nómina no encontrada')
    return withWorker
  }

  async create(input: {
    workerId: string
    month: number
    year: number
    baseSalary: number
    irpfPercent: number
    socialSecurityPercent?: number
    otherDeductions?: number
    otherDeductionsDesc?: string
    notes?: string
  }): Promise<PayrollWithWorker> {
    const validated = createPayrollSchema.parse(input)

    const existing = await this.repo.findByWorkerAndPeriod(
      validated.workerId,
      validated.month,
      validated.year,
    )
    if (existing) {
      throw new Error('Ya existe una nómina para este trabajador en este período')
    }

    const calc = this.calculatePayroll(
      validated.baseSalary,
      validated.irpfPercent,
      validated.socialSecurityPercent,
      validated.otherDeductions,
    )

    const payroll = await this.repo.create({
      workerId: validated.workerId,
      month: validated.month,
      year: validated.year,
      baseSalary: calc.baseSalary,
      irpfPercent: calc.irpfPercent,
      irpfAmount: calc.irpfAmount,
      socialSecurityPercent: calc.socialSecurityPercent,
      socialSecurityAmount: calc.socialSecurityAmount,
      otherDeductions: calc.otherDeductions,
      otherDeductionsDesc: validated.otherDeductionsDesc,
      grossPay: calc.grossPay,
      netPay: calc.netPay,
      notes: validated.notes,
    })

    const withWorker = await this.repo.findById(payroll.id)
    if (!withWorker) throw new Error('Error al crear la nómina')
    return withWorker
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id)
  }
}
