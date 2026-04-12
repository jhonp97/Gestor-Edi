import { BaseRepository } from './base.repository'
import type { Worker, CreateWorkerInput, UpdateWorkerInput } from '@/types'

export class WorkerRepository extends BaseRepository {
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

  async findByDni(dni: string): Promise<Worker | null> {
    return this.prisma.worker.findFirst({
      where: { dni, ...this.tenantFilter() },
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
    return this.prisma.worker.create({
      data: {
        ...data,
        organizationId: this.organizationId!,
      },
    })
  }

  async update(id: string, data: UpdateWorkerInput): Promise<Worker | null> {
    const worker = await this.findById(id)
    if (!worker) return null
    return this.prisma.worker.update({
      where: { id },
      data,
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
