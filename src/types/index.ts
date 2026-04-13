import type { Truck, Transaction, TruckStatus, TransactionType, Worker, WorkerStatus, Payroll } from '@prisma/client'

export type { Truck, Transaction, TruckStatus, TransactionType, Worker, WorkerStatus, Payroll }

// Worker type now includes dniHash (encrypted at app level)
export type WorkerWithEncryption = Worker & {
  dniHash: string | null
}

export type Organization = {
  id: string
  name: string
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

export type CreateTruckInput = {
  plate: string
  brand: string
  model: string
  year: number
  status?: TruckStatus
}

export type CreateTransactionInput = {
  truckId: string
  type: TransactionType
  amount: number
  description: string
  date: Date
  category?: string
}

export type TransactionWithTruck = Transaction & {
  truck: Truck
}

export type DashboardSummary = {
  income: number
  expenses: number
  netProfit: number
  transactionCount: number
}

export type CreateWorkerInput = Omit<Worker, 'id' | 'createdAt' | 'updatedAt' | 'payrolls' | 'organizationId' | 'dniHash'>

export type UpdateWorkerInput = Partial<Omit<Worker, 'id' | 'createdAt' | 'updatedAt' | 'payrolls' | 'organizationId' | 'dniHash'>>

export type WorkerWithTruck = Worker & {
  truck: Truck | null
}

export type WorkerWithPayrolls = Worker & {
  payrolls: Payroll[]
}

// --- Payroll Types ---

export type PayrollWithWorker = Payroll & {
  worker: Worker
}

export type PayrollWithExtras = Payroll & {
  bonuses: number
  bonusesDesc: string | null
}

export type MonthlyPayrollSummary = {
  totalGross: number
  totalDeductions: number
  totalNet: number
  workerCount: number
}

export type PayrollCalculation = {
  baseSalary: number
  irpfPercent: number
  irpfAmount: number
  socialSecurityPercent: number
  socialSecurityAmount: number
  bonuses: number
  bonusesDesc: string | null
  otherDeductions: number
  otherDeductionsDesc: string | null
  grossPay: number
  netPay: number
}
