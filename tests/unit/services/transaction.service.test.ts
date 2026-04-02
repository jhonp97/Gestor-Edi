import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionService } from '@/services/transaction.service'
import { createTransaction, createTransactionInput } from '../../factories/transaction.factory'
import { ZodError } from 'zod'

import type { TransactionRepository } from '@/repositories/transaction.repository'
import type { CreateTransactionInput } from '@/types'

interface MockTransactionRepo {
  findAll: ReturnType<typeof vi.fn>
  findById: ReturnType<typeof vi.fn>
  findByTruckId: ReturnType<typeof vi.fn>
  findByDateRange: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

describe('TransactionService', () => {
  let service: TransactionService
  let mockRepo: MockTransactionRepo

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByTruckId: vi.fn(),
      findByDateRange: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }
    service = new TransactionService(mockRepo as unknown as TransactionRepository)
  })

  describe('getAll', () => {
    it('debería retornar todas las transacciones', async () => {
      const transactions = [createTransaction(), createTransaction()]
      mockRepo.findAll.mockResolvedValue(transactions)

      const result = await service.getAll()

      expect(result).toEqual(transactions)
      expect(mockRepo.findAll).toHaveBeenCalledTimes(1)
    })

    it('debería retornar un array vacío si no hay transacciones', async () => {
      mockRepo.findAll.mockResolvedValue([])

      const result = await service.getAll()

      expect(result).toEqual([])
    })
  })

  describe('getById', () => {
    it('debería retornar una transacción por su ID', async () => {
      const tx = createTransaction({ id: 'tx-1' })
      mockRepo.findById.mockResolvedValue(tx)

      const result = await service.getById('tx-1')

      expect(result).toEqual(tx)
      expect(mockRepo.findById).toHaveBeenCalledWith('tx-1')
    })

    it('debería retornar null si la transacción no existe', async () => {
      mockRepo.findById.mockResolvedValue(null)

      const result = await service.getById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('getByTruck', () => {
    it('debería retornar las transacciones de un camión', async () => {
      const transactions = [
        createTransaction({ truckId: 'truck-1' }),
        createTransaction({ truckId: 'truck-1' }),
      ]
      mockRepo.findByTruckId.mockResolvedValue(transactions)

      const result = await service.getByTruck('truck-1')

      expect(result).toEqual(transactions)
      expect(mockRepo.findByTruckId).toHaveBeenCalledWith('truck-1')
    })

    it('debería retornar un array vacío si el camión no tiene transacciones', async () => {
      mockRepo.findByTruckId.mockResolvedValue([])

      const result = await service.getByTruck('truck-1')

      expect(result).toEqual([])
    })
  })

  describe('getDashboardSummary', () => {
    it('debería calcular correctamente ingresos, gastos y ganancia neta', async () => {
      const transactions = [
        createTransaction({ type: 'INCOME', amount: 1000 }),
        createTransaction({ type: 'INCOME', amount: 500 }),
        createTransaction({ type: 'EXPENSE', amount: 300 }),
        createTransaction({ type: 'EXPENSE', amount: 200 }),
      ]
      mockRepo.findByDateRange.mockResolvedValue(transactions)

      const start = new Date('2024-01-01')
      const end = new Date('2024-12-31')
      const result = await service.getDashboardSummary(start, end)

      expect(result).toEqual({
        income: 1500,
        expenses: 500,
        netProfit: 1000,
        transactionCount: 4,
      })
      expect(mockRepo.findByDateRange).toHaveBeenCalledWith(start, end)
    })

    it('debería retornar ceros si no hay transacciones', async () => {
      mockRepo.findByDateRange.mockResolvedValue([])

      const result = await service.getDashboardSummary(new Date(), new Date())

      expect(result).toEqual({
        income: 0,
        expenses: 0,
        netProfit: 0,
        transactionCount: 0,
      })
    })

    it('debería calcular solo ingresos si no hay gastos', async () => {
      const transactions = [
        createTransaction({ type: 'INCOME', amount: 2000 }),
      ]
      mockRepo.findByDateRange.mockResolvedValue(transactions)

      const result = await service.getDashboardSummary(new Date(), new Date())

      expect(result.income).toBe(2000)
      expect(result.expenses).toBe(0)
      expect(result.netProfit).toBe(2000)
    })
  })

  describe('create', () => {
    it('debería crear una transacción con datos válidos', async () => {
      const input = createTransactionInput()
      const created = createTransaction({ truckId: input.truckId })
      mockRepo.create.mockResolvedValue(created)

      const result = await service.create(input)

      expect(result).toEqual(created)
      expect(mockRepo.create).toHaveBeenCalled()
    })

    it('debería lanzar ZodError con datos inválidos', async () => {
      const invalidInput = { truckId: 'invalid-uuid', type: 'INVALID', amount: -100 }

      await expect(service.create(invalidInput as unknown as CreateTransactionInput)).rejects.toThrow(ZodError)
      expect(mockRepo.create).not.toHaveBeenCalled()
    })

    it('debería lanzar ZodError si el monto es negativo', async () => {
      const invalidInput = { ...createTransactionInput(), amount: -50 }

      await expect(service.create(invalidInput as unknown as CreateTransactionInput)).rejects.toThrow(ZodError)
    })

    it('debería lanzar ZodError si el monto es cero', async () => {
      const invalidInput = { ...createTransactionInput(), amount: 0 }

      await expect(service.create(invalidInput as unknown as CreateTransactionInput)).rejects.toThrow(ZodError)
    })
  })

  describe('update', () => {
    it('debería actualizar una transacción', async () => {
      const tx = createTransaction({ id: 'tx-1', amount: 1000 })
      const updated = { ...tx, amount: 2000 }
      mockRepo.update.mockResolvedValue(updated)

      const result = await service.update('tx-1', { amount: 2000 })

      expect(result).toEqual(updated)
      expect(mockRepo.update).toHaveBeenCalledWith('tx-1', { amount: 2000 })
    })
  })

  describe('delete', () => {
    it('debería eliminar una transacción', async () => {
      const tx = createTransaction({ id: 'tx-1' })
      mockRepo.delete.mockResolvedValue(tx)

      const result = await service.delete('tx-1')

      expect(result).toEqual(tx)
      expect(mockRepo.delete).toHaveBeenCalledWith('tx-1')
    })
  })
})
