import { TransactionRepository } from '@/repositories/transaction.repository'
import { createTransactionSchema } from '@/schemas'
import type { CreateTransactionInput, DashboardSummary } from '@/types'

export class TransactionService {
  constructor(private repo: TransactionRepository) {}

  async getAll() {
    return this.repo.findAll()
  }

  async getById(id: string) {
    return this.repo.findById(id)
  }

  async getByTruck(truckId: string) {
    return this.repo.findByTruckId(truckId)
  }

  async getDashboardSummary(start: Date, end: Date): Promise<DashboardSummary> {
    const transactions = await this.repo.findByDateRange(start, end)

    const income = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0)

    const expenses = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0)

    return {
      income,
      expenses,
      netProfit: income - expenses,
      transactionCount: transactions.length,
    }
  }

  async create(input: CreateTransactionInput) {
    const validated = createTransactionSchema.parse(input)
    return this.repo.create(validated)
  }

  async update(id: string, input: Partial<CreateTransactionInput>) {
    return this.repo.update(id, input)
  }

  async delete(id: string) {
    return this.repo.delete(id)
  }
}
