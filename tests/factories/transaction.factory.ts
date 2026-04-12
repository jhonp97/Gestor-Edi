import type { Transaction } from '@prisma/client'
import type { CreateTransactionInput } from '@/types'

let txCounter = 0

export function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  txCounter++
  return {
    id: overrides.id ?? `tx-${txCounter}`,
    truckId: overrides.truckId ?? '550e8400-e29b-41d4-a716-446655440001',
    type: overrides.type ?? 'INCOME',
    amount: overrides.amount ?? 1000,
    description: overrides.description ?? `Test transaction ${txCounter}`,
    date: overrides.date ?? new Date(),
    category: overrides.category ?? null,
    organizationId: overrides.organizationId ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

export function createTransactionInput(overrides: Partial<CreateTransactionInput> = {}): CreateTransactionInput {
  return {
    truckId: '550e8400-e29b-41d4-a716-446655440001',
    type: 'INCOME' as const,
    amount: 500,
    description: 'Test income',
    date: new Date(),
    category: 'Viaje',
    ...overrides,
  }
}
