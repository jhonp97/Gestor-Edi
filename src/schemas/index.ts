import { z } from 'zod'

export const createTruckSchema = z.object({
  plate: z.string().min(3).max(10).regex(/^[A-Z0-9-]+$/i, { error: 'Formato de matrícula inválido' }),
  brand: z.string().min(2).max(50),
  model: z.string().min(1).max(50),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional(),
})

export const createTransactionSchema = z.object({
  truckId: z.uuid(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().gt(0, { error: 'El monto debe ser positivo' }),
  description: z.string().min(3).max(255),
  date: z.coerce.date(),
  category: z.string().max(50).optional(),
})

export const createWorkerSchema = z.object({
  name: z.string().min(2).max(100),
  dni: z.string().regex(/^\d{8}[A-Z]$/, 'DNI inválido (formato: 12345678A)'),
  position: z.string().min(2).max(50),
  baseSalary: z.coerce.number().positive('El salario debe ser positivo'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).default('ACTIVE'),
  truckId: z.string().uuid().optional().nullable(),
})

export const updateWorkerSchema = createWorkerSchema.partial()

export type CreateTruckInput = z.infer<typeof createTruckSchema>
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type CreateWorkerInput = z.infer<typeof createWorkerSchema>
export type UpdateWorkerInput = z.infer<typeof updateWorkerSchema>

// --- Payroll Schemas ---

export const createPayrollSchema = z.object({
  workerId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2030),
  baseSalary: z.number().positive(),
  irpfPercent: z.number().min(0).max(100).default(0),
  socialSecurityPercent: z.number().min(0).max(100).default(6.35),
  otherDeductions: z.number().min(0).default(0),
  otherDeductionsDesc: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
})

export const generatePayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2030),
  irpfPercent: z.number().min(0).max(100).default(15),
})

export type CreatePayrollInput = z.infer<typeof createPayrollSchema>
export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>
