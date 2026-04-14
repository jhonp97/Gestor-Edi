import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma BEFORE importing the repository
vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
  },
}))

import { TransactionRepository, setPlanServiceFactory } from '@/repositories/transaction.repository'
import type { Transaction, Truck } from '@prisma/client'
import type { CreateTransactionInput } from '@/types'

// Get the mocked prisma instance
const { prisma: mockPrisma } = await import('@/lib/prisma')

// Create a mock PlanService for all transaction repo tests
const mockPlanService = {
  checkLimit: vi.fn().mockResolvedValue(undefined),
  getPlanConfig: vi.fn().mockReturnValue({ trucks: 5, workers: 10, transactions: 100, orgs: 1 }),
}

beforeEach(() => {
  setPlanServiceFactory(() => mockPlanService as any)
})

describe('TransactionRepository', () => {
  let repo: TransactionRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new TransactionRepository()
  })

  const truckFixture: Truck = {
    id: 'truck-1',
    plate: 'ABC-123',
    brand: 'Volvo',
    model: 'FH',
    year: 2020,
    status: 'ACTIVE',
    organizationId: 'test-org-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const txFixture: Transaction & { truck: Truck } = {
    id: '1',
    truckId: 'truck-1',
    type: 'INCOME',
    amount: 1000,
    description: 'Test',
    date: new Date(),
    category: null,
    organizationId: 'test-org-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    truck: truckFixture,
  }

  describe('findAll', () => {
    it('debería retornar todas las transacciones con su camión', async () => {
      vi.mocked(mockPrisma.transaction.findMany).mockResolvedValue([txFixture])

      const result = await repo.findAll()

      expect(result).toEqual([txFixture])
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {},
        include: { truck: true },
        orderBy: { date: 'desc' },
      })
    })
  })

  describe('findById', () => {
    it('debería retornar una transacción con su camión', async () => {
      vi.mocked(mockPrisma.transaction.findFirst).mockResolvedValue(txFixture)

      const result = await repo.findById('1')

      expect(result).toEqual(txFixture)
      expect(mockPrisma.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { truck: true },
      })
    })

    it('debería retornar null si no existe', async () => {
      vi.mocked(mockPrisma.transaction.findFirst).mockResolvedValue(null)

      const result = await repo.findById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('findByTruckId', () => {
    it('debería retornar las transacciones de un camión', async () => {
      vi.mocked(mockPrisma.transaction.findMany).mockResolvedValue([txFixture])

      const result = await repo.findByTruckId('truck-1')

      expect(result).toEqual([txFixture])
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: { truckId: 'truck-1' },
        include: { truck: true },
        orderBy: { date: 'desc' },
      })
    })

    it('debería retornar un array vacío si no hay transacciones', async () => {
      vi.mocked(mockPrisma.transaction.findMany).mockResolvedValue([])

      const result = await repo.findByTruckId('truck-1')

      expect(result).toEqual([])
    })
  })

  describe('findByDateRange', () => {
    it('debería filtrar transacciones por rango de fechas', async () => {
      const start = new Date('2024-01-01')
      const end = new Date('2024-12-31')
      vi.mocked(mockPrisma.transaction.findMany).mockResolvedValue([txFixture])

      const result = await repo.findByDateRange(start, end)

      expect(result).toEqual([txFixture])
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          date: {
            gte: start,
            lte: end,
          },
        },
        include: { truck: true },
        orderBy: { date: 'desc' },
      })
    })
  })

  describe('create', () => {
    it('debería crear una transacción con fecha Date', async () => {
      const input = { truckId: 'truck-1', type: 'INCOME' as const, amount: 1000, description: 'Test', date: new Date('2024-01-01'), category: 'Viaje' }
      const created = { ...txFixture, ...input }
      vi.mocked(mockPrisma.transaction.create).mockResolvedValue(created)

      const result = await repo.create(input)

      expect(result).toEqual(created)
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          truckId: 'truck-1',
          type: 'INCOME',
          amount: 1000,
          date: expect.any(Date),
        }),
        include: { truck: true },
      })
    })

    it('debería crear una transacción con fecha string', async () => {
      const input: CreateTransactionInput = { truckId: 'truck-1', type: 'EXPENSE', amount: 500, description: 'Test', date: new Date('2024-01-01T00:00:00Z') }
      const created = { ...txFixture, ...input, date: new Date('2024-01-01T00:00:00Z') }
      vi.mocked(mockPrisma.transaction.create).mockResolvedValue(created)

      const result = await repo.create({ ...input, date: '2024-01-01T00:00:00Z' } as unknown as CreateTransactionInput)

      expect(result).toEqual(created)
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          date: expect.any(Date),
        }),
        include: { truck: true },
      })
    })
  })

  describe('update', () => {
    it('debería actualizar una transacción', async () => {
      const updated = { ...txFixture, amount: 2000, description: 'Updated', type: 'EXPENSE' as const }
      vi.mocked(mockPrisma.transaction.findFirst).mockResolvedValue(txFixture)
      vi.mocked(mockPrisma.transaction.update).mockResolvedValue(updated)

      const result = await repo.update('1', { amount: 2000 })

      expect(result).toEqual(updated)
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { amount: 2000 },
        include: { truck: true },
      })
    })

    it('debería convertir fecha string a Date al actualizar', async () => {
      vi.mocked(mockPrisma.transaction.findFirst).mockResolvedValue(txFixture)
      vi.mocked(mockPrisma.transaction.update).mockResolvedValue(txFixture)

      await repo.update('1', { date: new Date('2024-06-01T00:00:00Z') })

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { date: expect.any(Date) },
        include: { truck: true },
      })
    })
  })

  describe('delete', () => {
    it('debería eliminar una transacción', async () => {
      vi.mocked(mockPrisma.transaction.findFirst).mockResolvedValue(txFixture)
      vi.mocked(mockPrisma.transaction.delete).mockResolvedValue(txFixture)

      const result = await repo.delete('1')

      expect(result).toEqual(txFixture)
      expect(mockPrisma.transaction.delete).toHaveBeenCalledWith({ where: { id: '1' } })
    })
  })
})
