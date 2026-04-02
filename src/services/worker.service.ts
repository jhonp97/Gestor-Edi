import { WorkerRepository } from '@/repositories/worker.repository'
import { createWorkerSchema, updateWorkerSchema } from '@/schemas'
import type { CreateWorkerInput, UpdateWorkerInput } from '@/types'

export class WorkerService {
  constructor(private repo: WorkerRepository) {}

  async getAll() {
    return this.repo.findAll()
  }

  async getById(id: string) {
    return this.repo.findById(id)
  }

  async getActive() {
    return this.repo.findActive()
  }

  async create(input: CreateWorkerInput) {
    const validated = createWorkerSchema.parse(input)
    const existing = await this.repo.findByDni(validated.dni)
    if (existing) throw new Error('Ya existe un trabajador con ese DNI')
    const { endDate, ...rest } = validated
    return this.repo.create({ ...rest, endDate: endDate ?? null } as CreateWorkerInput)
  }

  async update(id: string, input: UpdateWorkerInput) {
    const validated = updateWorkerSchema.parse(input)
    if (validated.dni) {
      const existing = await this.repo.findByDni(validated.dni)
      if (existing && existing.id !== id) {
        throw new Error('Ya existe un trabajador con ese DNI')
      }
    }
    return this.repo.update(id, validated)
  }

  async delete(id: string) {
    return this.repo.delete(id)
  }

  async assignTruck(workerId: string, truckId: string) {
    return this.repo.update(workerId, { truckId })
  }

  async unassignTruck(workerId: string) {
    return this.repo.update(workerId, { truckId: null })
  }
}
