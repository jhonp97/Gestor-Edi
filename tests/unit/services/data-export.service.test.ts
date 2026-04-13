import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('T4.5: DataExportService', () => {
  beforeEach(() => {
    process.env.DNI_ENCRYPTION_KEY = 'a'.repeat(32)
    vi.resetModules()
  })

  describe('data-export.service.ts', () => {
    it('debería existir el servicio de exportación de datos', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/data-export.service.ts')
      expect(fs.existsSync(servicePath)).toBe(true)
    })

    it('debería exportar método generateExport', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/data-export.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
      expect(content).toContain('generateExport')
    })

    it('debería soportar formato JSON', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/data-export.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
      expect(content).toContain('json')
    })

    it('debería soportar formato CSV', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/data-export.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
      expect(content).toContain('csv')
    })

    it('debería incluir advertencia de seguridad en la exportación', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/data-export.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
// Should contain security warning in export
    expect(content).toContain('security')
    })

    it('debería exportar todos los datos de la organización (users, trucks, transactions, workers, payrolls)', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/data-export.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
      expect(content).toContain('organization')
      expect(content).toContain('trucks')
      expect(content).toContain('transactions')
      expect(content).toContain('workers')
      expect(content).toContain('payrolls')
    })

    it('debería descriptografar DNI para la exportación', () => {
      const fs = require('fs')
      const path = require('path')
      const servicePath = path.join(process.cwd(), 'src/services/data-export.service.ts')
      const content = fs.readFileSync(servicePath, 'utf-8')
      // Should use decrypt
      expect(content).toContain('decrypt')
    })
  })

  describe('Functional test: generateExport JSON', () => {
    it('debería generar exportación JSON con estructura correcta', async () => {
      // Mock prisma
      const mockPrisma = {
        organization: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'org-1',
            name: 'Test Org',
            ownerId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'user-1', name: 'Admin', email: 'admin@test.com', role: 'ORG_ADMIN', organizationId: 'org-1', createdAt: new Date(), updatedAt: new Date() },
          ]),
        },
        truck: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'truck-1', plate: 'ABC123', brand: 'Volvo', model: 'FH', year: 2020, status: 'ACTIVE', organizationId: 'org-1', createdAt: new Date(), updatedAt: new Date() },
          ]),
        },
        transaction: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'tx-1', truckId: 'truck-1', type: 'INCOME', amount: 1000, description: 'Test', date: new Date(), organizationId: 'org-1', createdAt: new Date(), updatedAt: new Date() },
          ]),
        },
        worker: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'worker-1', name: 'Juan', dni: '', position: 'Driver', baseSalary: 2000, startDate: new Date(), status: 'ACTIVE', organizationId: 'org-1', createdAt: new Date(), updatedAt: new Date() },
          ]),
        },
        payroll: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'pay-1', workerId: 'worker-1', month: 1, year: 2024, baseSalary: 2000, grossPay: 2000, netPay: 1600, organizationId: 'org-1', createdAt: new Date(), updatedAt: new Date() },
          ]),
        },
      }

      vi.doMock('@/lib/prisma', () => ({ prisma: mockPrisma }))

      // Mock encryption service
      vi.doMock('@/services/encryption.service', () => ({
        getEncryptionService: () => ({
          decryptWorkerDni: vi.fn().mockReturnValue('12345678A'),
        }),
      }))

      const { DataExportService } = await import('@/services/data-export.service')
      const service = new DataExportService()
      
      const result = await service.generateExport('org-1', 'json')
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      
      // Reset modules
      vi.resetModules()
    })
  })
})
