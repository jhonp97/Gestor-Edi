import { BaseRepository } from './base.repository'
import type { Truck, CreateTruckInput } from '@/types'

export class TruckRepository extends BaseRepository {
  async findAll(): Promise<Truck[]> {
    return this.prisma.truck.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string): Promise<Truck | null> {
    return this.prisma.truck.findUnique({
      where: { id },
    })
  }

  async findByPlate(plate: string): Promise<Truck | null> {
    return this.prisma.truck.findUnique({
      where: { plate },
    })
  }

  async create(data: CreateTruckInput): Promise<Truck> {
    return this.prisma.truck.create({
      data,
    })
  }

  async update(id: string, data: Partial<CreateTruckInput>): Promise<Truck> {
    return this.prisma.truck.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<Truck> {
    return this.prisma.truck.delete({
      where: { id },
    })
  }
}
