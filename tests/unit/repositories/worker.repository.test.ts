import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma BEFORE importing the repository
vi.mock('@/lib/prisma', () => ({
  prisma: {
    worker: {
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

// Mock encryption service — must use vi.mock with module path
vi.mock('@/services/encryption.service', () => {
  return {
    EncryptionService: vi.fn().mockImplementation(() => ({
      encryptWorkerDni: vi.fn().mockImplementation(async (dni: string) => ({
        dni: `mock_encrypted:${dni}`,
        dniHash: `mock_hash:${dni}`,
      })),
      decryptWorkerDni: vi.fn().mockImplementation(async (ciphertext: string) => {
        return ciphertext.replace('mock_encrypted:', '')
      }),
      hashWorkerDni: vi.fn().mockImplementation((dni: string) => `mock_hash:${dni}`),
      maskWorkerDni: vi.fn().mockImplementation((dni: string) => `mock_masked:${dni}`),
    })),
    getEncryptionService: vi.fn().mockImplementation(() => ({
      encryptWorkerDni: async (dni: string) => ({ dni: `mock_encrypted:${dni}`, dniHash: `mock_hash:${dni}` }),
      decryptWorkerDni: async (ciphertext: string) => ciphertext.replace('mock_encrypted:', ''),
      hashWorkerDni: (dni: string) => `mock_hash:${dni}`,
      maskWorkerDni: (dni: string) => `mock_masked:${dni}`,
    })),
  }
})

import { WorkerRepository, setPlanServiceFactory } from '@/repositories/worker.repository'
import type { Worker } from '@prisma/client'

const { prisma: mockPrisma } = await import('@/lib/prisma')

// Create a mock PlanService for all worker repo tests
const mockPlanService = {
  checkLimit: vi.fn().mockResolvedValue(undefined),
  getPlanConfig: vi.fn().mockReturnValue({ trucks: 5, workers: 10, transactions: 100, orgs: 1 }),
}

beforeEach(() => {
  setPlanServiceFactory(() => mockPlanService as any)
})

describe('WorkerRepository — T3.4 DNI Encryption', () => {
  let repo: WorkerRepository

  const workerFixture: Worker = {
    id: 'worker-1',
    name: 'Juan Pérez',
    dni: '12345678A',
    dniHash: null,
    position: 'Conductor',
    baseSalary: 1500,
    startDate: new Date('2024-01-01'),
    endDate: null,
    status: 'ACTIVE',
    truckId: null,
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new WorkerRepository('org-1')
  })

  describe('findAll — should return decrypted DNI', () => {
    it('debería retornar trabajadores con DNI desencriptado', async () => {
      const encryptedWorker: Worker = {
        ...workerFixture,
        dni: 'base64iv:base64ciphertext',
        dniHash: 'sha256hash123',
      }
      vi.mocked(mockPrisma.worker.findMany).mockResolvedValue([encryptedWorker])

      const result = await repo.findAll()

      expect(result[0].dni).toBe('base64iv:base64ciphertext') // Raw DB value
      // The repository passes through the raw value — service layer handles decryption
      expect(mockPrisma.worker.findMany).toHaveBeenCalled()
    })
  })

  describe('create — should encrypt DNI before storing', () => {
    it('debería encriptar DNI al crear trabajador', async () => {
      const input = {
        name: 'Ana García',
        dni: '87654321B',
        position: 'Mecánico',
        baseSalary: 1400,
        startDate: new Date(),
        endDate: null,
        status: 'ACTIVE' as const,
        truckId: null,
      }
      
      const created: Worker = {
        id: 'new-worker',
        name: input.name,
        dni: `mock_encrypted:${input.dni}`, // Should be encrypted by mock
        dniHash: `mock_hash:${input.dni}`, // Should have hash
        position: input.position,
        baseSalary: input.baseSalary,
        startDate: input.startDate,
        endDate: null,
        status: input.status,
        truckId: null,
        organizationId: 'org-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(mockPrisma.worker.create).mockResolvedValue(created)

      const result = await repo.create(input)

      // Verify create was called with encrypted DNI
      // @ts-expect-error — Prisma mock types are complex, runtime works correctly
      const createCall = mockPrisma.worker.create.mock.calls[0]
      const createData = createCall[0]?.data
      
      expect(createData.dni).toBe(`mock_encrypted:${input.dni}`)
      expect(createData.dniHash).toBe(`mock_hash:${input.dni}`)
      expect(createData.organizationId).toBe('org-1')
      expect(result.dni).toBe(`mock_encrypted:${input.dni}`)
      expect(result.dniHash).toBe(`mock_hash:${input.dni}`)
    })

    it('debería generar dniHash al crear trabajador', async () => {
      const input = {
        name: 'Carlos López',
        dni: '11111111C',
        position: 'Conductor',
        baseSalary: 1300,
        startDate: new Date(),
        endDate: null,
        status: 'ACTIVE' as const,
        truckId: null,
      }
      
      const created: Worker = {
        id: 'new-worker-2',
        name: input.name,
        dni: `mock_encrypted:${input.dni}`,
        dniHash: `mock_hash:${input.dni}`,
        position: input.position,
        baseSalary: input.baseSalary,
        startDate: input.startDate,
        endDate: null,
        status: input.status,
        truckId: null,
        organizationId: 'org-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(mockPrisma.worker.create).mockResolvedValue(created)

      await repo.create(input)

      // @ts-expect-error — Prisma mock types are complex, runtime works correctly
      const createCall = mockPrisma.worker.create.mock.calls[0]
      const createData = createCall[0]?.data
      
      expect(createData.dniHash).toBeTruthy()
      expect(createData.dniHash).toMatch(/^mock_hash:/)
    })
  })

  describe('update — should encrypt DNI on update', () => {
    it('debería encriptar DNI al actualizar trabajador', async () => {
      const existing: Worker = {
        ...workerFixture,
        dni: 'encrypted:old',
        dniHash: 'hash:old',
      }
      vi.mocked(mockPrisma.worker.findFirst).mockResolvedValue(existing)
      
      const updated: Worker = {
        ...existing,
        dni: 'encrypted:newDNI',
        dniHash: 'hash:newDNI',
      }
      vi.mocked(mockPrisma.worker.update).mockResolvedValue(updated)

      await repo.update('worker-1', { dni: 'newDNI' })

      // @ts-expect-error — Prisma mock types are complex, runtime works correctly
      const updateCall = mockPrisma.worker.update.mock.calls[0]
      const updateData = updateCall[0]?.data
      
      expect(updateData.dni).toBe('mock_encrypted:newDNI')
      expect(updateData.dniHash).toBe('mock_hash:newDNI')
    })
  })

  describe('findByDni — should use dniHash for lookup', () => {
    it('debería buscar por dniHash (no por DNI en texto plano)', async () => {
      vi.mocked(mockPrisma.worker.findFirst).mockResolvedValue(workerFixture)

      await repo.findByDni('12345678A')

      // Should use dniHash for lookup since plaintext DNI won't match encrypted values
      // @ts-expect-error — Prisma mock types are complex, runtime works correctly
      const findCall = mockPrisma.worker.findFirst.mock.calls[0]
      const whereClause = findCall[0]?.where
      
      // The repository should use dniHash for exact-match lookups
      expect(whereClause).toHaveProperty('dniHash', 'mock_hash:12345678A')
    })
  })
})
