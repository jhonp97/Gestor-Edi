import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TruckService } from '@/services/truck.service'
import { createTruck, createTruckInput } from '../../factories/truck.factory'
import { ZodError } from 'zod'
import type { TruckRepository } from '@/repositories/truck.repository'

interface MockTruckRepo {
  findAll: ReturnType<typeof vi.fn>
  findById: ReturnType<typeof vi.fn>
  findByPlate: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

describe('TruckService', () => {
  let service: TruckService
  let mockRepo: MockTruckRepo

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByPlate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }
    service = new TruckService(mockRepo as unknown as TruckRepository)
  })

  describe('getAll', () => {
    it('debería retornar todos los camiones', async () => {
      const trucks = [createTruck(), createTruck()]
      mockRepo.findAll.mockResolvedValue(trucks)

      const result = await service.getAll()

      expect(result).toEqual(trucks)
      expect(mockRepo.findAll).toHaveBeenCalledTimes(1)
    })

    it('debería retornar un array vacío si no hay camiones', async () => {
      mockRepo.findAll.mockResolvedValue([])

      const result = await service.getAll()

      expect(result).toEqual([])
    })
  })

  describe('getById', () => {
    it('debería retornar un camión por su ID', async () => {
      const truck = createTruck({ id: 'truck-1' })
      mockRepo.findById.mockResolvedValue(truck)

      const result = await service.getById('truck-1')

      expect(result).toEqual(truck)
      expect(mockRepo.findById).toHaveBeenCalledWith('truck-1')
    })

    it('debería retornar null si el camión no existe', async () => {
      mockRepo.findById.mockResolvedValue(null)

      const result = await service.getById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('debería crear un camión con datos válidos', async () => {
      const input = createTruckInput()
      const created = createTruck({ plate: input.plate })
      mockRepo.findByPlate.mockResolvedValue(null)
      mockRepo.create.mockResolvedValue(created)

      const result = await service.create(input)

      expect(result).toEqual(created)
      expect(mockRepo.findByPlate).toHaveBeenCalledWith(input.plate)
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining(input))
    })

    it('debería lanzar error si la matrícula ya existe', async () => {
      const input = createTruckInput()
      const existing = createTruck({ plate: input.plate })
      mockRepo.findByPlate.mockResolvedValue(existing)

      await expect(service.create(input)).rejects.toThrow(
        'Ya existe un camión con esa matrícula'
      )
      expect(mockRepo.create).not.toHaveBeenCalled()
    })

    it('debería lanzar ZodError con datos inválidos', async () => {
      const invalidInput = { plate: '', brand: '', model: '', year: 1800 } as unknown as Parameters<TruckService['create']>[0]

      await expect(service.create(invalidInput)).rejects.toThrow(ZodError)
      expect(mockRepo.findByPlate).not.toHaveBeenCalled()
      expect(mockRepo.create).not.toHaveBeenCalled()
    })

    it('debería lanzar ZodError si la matrícula tiene formato inválido', async () => {
      const invalidInput = createTruckInput({ plate: 'ABC@#$' })

      await expect(service.create(invalidInput)).rejects.toThrow(ZodError)
    })
  })

  describe('update', () => {
    it('debería actualizar un camión', async () => {
      const truck = createTruck({ id: 'truck-1', brand: 'Old Brand' })
      const updated = { ...truck, brand: 'New Brand' }
      mockRepo.update.mockResolvedValue(updated)

      const result = await service.update('truck-1', { brand: 'New Brand' })

      expect(result).toEqual(updated)
      expect(mockRepo.update).toHaveBeenCalledWith('truck-1', { brand: 'New Brand' })
    })
  })

  describe('delete', () => {
    it('debería eliminar un camión', async () => {
      const truck = createTruck({ id: 'truck-1' })
      mockRepo.delete.mockResolvedValue(truck)

      const result = await service.delete('truck-1')

      expect(result).toEqual(truck)
      expect(mockRepo.delete).toHaveBeenCalledWith('truck-1')
    })
  })
})
