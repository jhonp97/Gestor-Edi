import { TruckRepository } from '@/repositories/truck.repository'
import { createTruckSchema } from '@/schemas'
import type { CreateTruckInput } from '@/types'

export class TruckService {
  constructor(private repo: TruckRepository) {}

  async getAll() {
    return this.repo.findAll()
  }

  async getById(id: string) {
    return this.repo.findById(id)
  }

  async create(input: CreateTruckInput) {
    const validated = createTruckSchema.parse(input)
    const existing = await this.repo.findByPlate(validated.plate)
    if (existing) throw new Error('Ya existe un camión con esa matrícula')
    return this.repo.create(validated)
  }

  async update(id: string, input: Partial<CreateTruckInput>) {
    return this.repo.update(id, input)
  }

  async delete(id: string) {
    return this.repo.delete(id)
  }
}
