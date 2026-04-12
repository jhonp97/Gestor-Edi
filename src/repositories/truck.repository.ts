import { BaseRepository } from './base.repository'
import type { Truck, CreateTruckInput } from '@/types'

export class TruckRepository extends BaseRepository {
  constructor(organizationId?: string | null) {
    super(organizationId)
  }

  async findAll(): Promise<Truck[]> {
    return this.prisma.truck.findMany({
      where: this.tenantFilter(),
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string): Promise<Truck | null> {
    return this.prisma.truck.findFirst({
      where: { id, ...this.tenantFilter() },
    })
  }

  async findByPlate(plate: string): Promise<Truck | null> {
    return this.prisma.truck.findFirst({
      where: { plate, ...this.tenantFilter() },
    })
  }

  async create(data: CreateTruckInput): Promise<Truck> {
    return this.prisma.truck.create({
      data: {
        ...data,
        organizationId: this.organizationId!,
      },
    })
  }

  async update(id: string, data: Partial<CreateTruckInput>): Promise<Truck | null> {
    const truck = await this.findById(id)
    if (!truck) return null
    return this.prisma.truck.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<Truck> {
    const truck = await this.findById(id)
    if (!truck) throw new Error('Not found')
    return this.prisma.truck.delete({
      where: { id },
    })
  }
}
