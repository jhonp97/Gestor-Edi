import { BaseRepository } from './base.repository'
import type { Transaction, CreateTransactionInput } from '@/types'

export class TransactionRepository extends BaseRepository {
  constructor(organizationId?: string | null) {
    super(organizationId)
  }

  async findAll(): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: this.tenantFilter(),
      include: { truck: true },
      orderBy: { date: 'desc' },
    })
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: { id, ...this.tenantFilter() },
      include: { truck: true },
    })
  }

  async findByTruckId(truckId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { truckId, ...this.tenantFilter() },
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
        ...this.tenantFilter(),
      },
      include: { truck: true },
      orderBy: { date: 'desc' },
    })
  }

  async create(data: CreateTransactionInput): Promise<Transaction> {
    return this.prisma.transaction.create({
      data: {
        ...data,
        organizationId: this.organizationId!,
        date: data.date instanceof Date ? data.date : new Date(data.date),
      },
      include: { truck: true },
    })
  }

  async update(id: string, data: Partial<CreateTransactionInput>): Promise<Transaction | null> {
    const tx = await this.findById(id)
    if (!tx) return null
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
    const tx = await this.findById(id)
    if (!tx) throw new Error('Not found')
    return this.prisma.transaction.delete({
      where: { id },
    })
  }
}
