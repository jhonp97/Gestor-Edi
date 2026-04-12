import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma BEFORE importing the repository
vi.mock('@/lib/prisma', () => ({
  prisma: {
    truck: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { TruckRepository } from '@/repositories/truck.repository'
import type { Truck } from '@prisma/client'

// Get the mocked prisma instance
const { prisma: mockPrisma } = await import('@/lib/prisma')

describe('TruckRepository', () => {
  let repo: TruckRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new TruckRepository()
  })

  const truckFixture: Truck = {
    id: '1',
    plate: 'ABC-123',
    brand: 'Volvo',
    model: 'FH',
    year: 2020,
    status: 'ACTIVE',
    organizationId: 'test-org-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe('findAll', () => {
    it('debería retornar todos los camiones ordenados por fecha', async () => {
      vi.mocked(mockPrisma.truck.findMany).mockResolvedValue([truckFixture])

      const result = await repo.findAll()

      expect(result).toEqual([truckFixture])
      expect(mockPrisma.truck.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('findById', () => {
    it('debería retornar un camión por ID', async () => {
      vi.mocked(mockPrisma.truck.findUnique).mockResolvedValue(truckFixture)

      const result = await repo.findById('1')

      expect(result).toEqual(truckFixture)
      expect(mockPrisma.truck.findUnique).toHaveBeenCalledWith({ where: { id: '1' } })
    })

    it('debería retornar null si no existe', async () => {
      vi.mocked(mockPrisma.truck.findUnique).mockResolvedValue(null)

      const result = await repo.findById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('findByPlate', () => {
    it('debería retornar un camión por matrícula', async () => {
      vi.mocked(mockPrisma.truck.findUnique).mockResolvedValue(truckFixture)

      const result = await repo.findByPlate('ABC-123')

      expect(result).toEqual(truckFixture)
      expect(mockPrisma.truck.findUnique).toHaveBeenCalledWith({ where: { plate: 'ABC-123' } })
    })

    it('debería retornar null si no existe la matrícula', async () => {
      vi.mocked(mockPrisma.truck.findUnique).mockResolvedValue(null)

      const result = await repo.findByPlate('XYZ-999')

      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('debería crear un nuevo camión', async () => {
      const input = { plate: 'ABC-123', brand: 'Volvo', model: 'FH', year: 2020 }
      const created: Truck = { ...truckFixture, ...input }
      vi.mocked(mockPrisma.truck.create).mockResolvedValue(created)

      const result = await repo.create(input)

      expect(result).toEqual(created)
      expect(mockPrisma.truck.create).toHaveBeenCalledWith({ data: input })
    })
  })

  describe('update', () => {
    it('debería actualizar un camión', async () => {
      const updated: Truck = { ...truckFixture, brand: 'Scania' }
      vi.mocked(mockPrisma.truck.update).mockResolvedValue(updated)

      const result = await repo.update('1', { brand: 'Scania' })

      expect(result).toEqual(updated)
      expect(mockPrisma.truck.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { brand: 'Scania' },
      })
    })
  })

  describe('delete', () => {
    it('debería eliminar un camión', async () => {
      vi.mocked(mockPrisma.truck.delete).mockResolvedValue(truckFixture)

      const result = await repo.delete('1')

      expect(result).toEqual(truckFixture)
      expect(mockPrisma.truck.delete).toHaveBeenCalledWith({ where: { id: '1' } })
    })
  })
})
