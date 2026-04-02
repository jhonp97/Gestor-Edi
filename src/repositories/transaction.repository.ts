import { BaseRepository } from './base.repository'
import type { Transaction, CreateTransactionInput } from '@/types'

export class TransactionRepository extends BaseRepository {
  async findAll(): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      include: { truck: true },
      orderBy: { date: 'desc' },
    })
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: { truck: true },
    })
  }

  async findByTruckId(truckId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { truckId },
      include: { truck: true },
      orderBy: { date: 'desc' },
    })
  }

  async findByDateRange(start: Date, end: Date): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      include: { truck: true },
      orderBy: { date: 'desc' },
    })
  }

  async create(data: CreateTransactionInput): Promise<Transaction> {
    return this.prisma.transaction.create({
      data: {
        ...data,
        date: data.date instanceof Date ? data.date : new Date(data.date),
      },
      include: { truck: true },
    })
  }

  async update(id: string, data: Partial<CreateTransactionInput>): Promise<Transaction> {
    const updateData: Partial<CreateTransactionInput> = { ...data }
    if (data.date) {
      updateData.date = data.date instanceof Date ? data.date : new Date(data.date)
    }
    return this.prisma.transaction.update({
      where: { id },
      data: updateData,
      include: { truck: true },
    })
  }

  async delete(id: string): Promise<Transaction> {
    return this.prisma.transaction.delete({
      where: { id },
    })
  }
}
