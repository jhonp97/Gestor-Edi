import { BaseRepository } from './base.repository'
import type { Worker, CreateWorkerInput, UpdateWorkerInput } from '@/types'

export class WorkerRepository extends BaseRepository {
  async findAll(): Promise<Worker[]> {
    return this.prisma.worker.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string): Promise<Worker | null> {
    return this.prisma.worker.findUnique({
      where: { id },
    })
  }

  async findByDni(dni: string): Promise<Worker | null> {
    return this.prisma.worker.findUnique({
      where: { dni },
    })
  }

  async findByTruckId(truckId: string): Promise<Worker[]> {
    return this.prisma.worker.findMany({
      where: { truckId },
      orderBy: { name: 'asc' },
    })
  }

  async findActive(): Promise<Worker[]> {
    return this.prisma.worker.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    })
  }

  async create(data: CreateWorkerInput): Promise<Worker> {
    return this.prisma.worker.create({
      data,
    })
  }

  async update(id: string, data: UpdateWorkerInput): Promise<Worker> {
    return this.prisma.worker.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<Worker> {
    return this.prisma.worker.delete({
      where: { id },
    })
  }
}
