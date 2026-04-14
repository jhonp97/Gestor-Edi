import { BaseRepository } from './base.repository'
import { getEncryptionService } from '@/services/encryption.service'
import { PlanService } from '@/services/plan.service'
import type { Worker, CreateWorkerInput, UpdateWorkerInput } from '@/types'

// Default factory — can be overridden in tests
let createPlanService = () => new PlanService()
export function setPlanServiceFactory(factory: () => PlanService) {
  createPlanService = factory
}

export class WorkerRepository extends BaseRepository {
  private encryption = getEncryptionService()
  private planService = createPlanService()

  constructor(organizationId?: string | null) {
    super(organizationId)
  }

  async findAll(): Promise<Worker[]> {
    return this.prisma.worker.findMany({
      where: this.tenantFilter(),
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string): Promise<Worker | null> {
    return this.prisma.worker.findFirst({
      where: { id, ...this.tenantFilter() },
    })
  }

  async findByDni(plaintextDni: string): Promise<Worker | null> {
    // Use dniHash for exact-match lookup since dni is encrypted
    const dniHash = this.encryption.hashWorkerDni(plaintextDni)
    return this.prisma.worker.findFirst({
      where: { dniHash, ...this.tenantFilter() },
    })
  }

  async findByTruckId(truckId: string): Promise<Worker[]> {
    return this.prisma.worker.findMany({
      where: { truckId, ...this.tenantFilter() },
      orderBy: { name: 'asc' },
    })
  }

  async findActive(): Promise<Worker[]> {
    return this.prisma.worker.findMany({
      where: { status: 'ACTIVE', ...this.tenantFilter() },
      orderBy: { name: 'asc' },
    })
  }

  async create(data: CreateWorkerInput): Promise<Worker> {
    // Check plan limit before creating
    if (this.organizationId) {
      await this.planService.checkLimit(this.organizationId, 'workers')
    }

    // Encrypt DNI before storing
    const { dni: encryptedDni, dniHash } = await this.encryption.encryptWorkerDni(data.dni)
    
    return this.prisma.worker.create({
      data: {
        ...data,
        dni: encryptedDni,
        dniHash,
        organizationId: this.organizationId!,
      },
    })
  }

  async update(id: string, data: UpdateWorkerInput): Promise<Worker | null> {
    const worker = await this.findById(id)
    if (!worker) return null

    // If DNI is being updated, encrypt it
    const updateData = { ...data }
    if (data.dni) {
      const { dni: encryptedDni, dniHash } = await this.encryption.encryptWorkerDni(data.dni)
      updateData.dni = encryptedDni
      // Add dniHash to the update data
      return this.prisma.worker.update({
        where: { id },
        data: {
          ...updateData,
          dniHash,
        },
      })
    }

    return this.prisma.worker.update({
      where: { id },
      data: updateData,
    })
  }

  async delete(id: string): Promise<Worker> {
    const worker = await this.findById(id)
    if (!worker) throw new Error('Not found')
    return this.prisma.worker.delete({
      where: { id },
    })
  }
}
