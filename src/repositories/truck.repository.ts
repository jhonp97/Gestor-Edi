import { BaseRepository } from './base.repository'
import { PlanService } from '@/services/plan.service'
import type { Truck, CreateTruckInput } from '@/types'

// Default factory — can be overridden in tests
let createPlanService = () => new PlanService()
export function setPlanServiceFactory(factory: () => PlanService) {
  createPlanService = factory
}

export class TruckRepository extends BaseRepository {
  private planService = createPlanService()

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
    // Check plan limit before creating
    if (this.organizationId) {
      await this.planService.checkLimit(this.organizationId, 'trucks')
    }

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
