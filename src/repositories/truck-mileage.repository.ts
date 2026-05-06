import { BaseRepository } from './base.repository'
import type { TruckMileage } from '@prisma/client'

type CreateMileageData = {
  truckId: string
  date: Date
  km: number
  notes?: string | null
  organizationId: string
}

type MileageFilters = {
  year?: number
  month?: number
}

export class TruckMileageRepository extends BaseRepository {
  constructor(organizationId?: string | null) {
    super(organizationId)
  }

  async create(data: CreateMileageData): Promise<TruckMileage> {
    // Normalize date to avoid timezone issues with @db.Date
    const normalizedDate = new Date(data.date)
    normalizedDate.setUTCHours(12, 0, 0, 0)

    return this.prisma.truckMileage.create({
      data: {
        truckId: data.truckId,
        date: normalizedDate,
        km: data.km,
        notes: data.notes ?? null,
        organizationId: data.organizationId,
      },
    })
  }

  async findByTruckAndDate(truckId: string, date: Date): Promise<TruckMileage | null> {
    const normalizedDate = new Date(date)
    normalizedDate.setUTCHours(12, 0, 0, 0)

    return this.prisma.truckMileage.findFirst({
      where: {
        truckId,
        date: normalizedDate,
        ...this.tenantFilter(),
      },
    })
  }

  async findByTruck(truckId: string, filters?: MileageFilters): Promise<TruckMileage[]> {
    const where: Record<string, unknown> = {
      truckId,
      ...this.tenantFilter(),
    }

    if (filters?.year) {
      where.date = {
        gte: new Date(filters.year, 0, 1),
        lt: new Date(filters.year + 1, 0, 1),
      }
    }

    if (filters?.month !== undefined && filters?.year) {
      where.date = {
        gte: new Date(filters.year, filters.month - 1, 1),
        lt: new Date(filters.year, filters.month, 1),
      }
    }

    return this.prisma.truckMileage.findMany({
      where: where as any,
      orderBy: { date: 'desc' },
    })
  }

  async getTotalKm(truckId: string): Promise<number> {
    const result = await this.prisma.truckMileage.aggregate({
      _sum: { km: true },
      where: { truckId, ...this.tenantFilter() },
    })
    return result._sum.km ?? 0
  }

  async getMonthlyTotal(truckId: string, year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1)

    const result = await this.prisma.truckMileage.aggregate({
      _sum: { km: true },
      where: {
        truckId,
        date: { gte: startDate, lt: endDate },
        ...this.tenantFilter(),
      },
    })
    return result._sum.km ?? 0
  }

  async getYearlyTotal(truckId: string, year: number): Promise<number> {
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year + 1, 0, 1)

    const result = await this.prisma.truckMileage.aggregate({
      _sum: { km: true },
      where: {
        truckId,
        date: { gte: startDate, lt: endDate },
        ...this.tenantFilter(),
      },
    })
    return result._sum.km ?? 0
  }

  async delete(id: string): Promise<void> {
    await this.prisma.truckMileage.delete({ where: { id } })
  }

  async getYearlyBreakdown(truckId: string): Promise<Map<number, number>> {
    const records = await this.prisma.truckMileage.findMany({
      where: { truckId, ...this.tenantFilter() },
      select: { km: true, date: true },
    })

    const breakdown = new Map<number, number>()
    for (const record of records) {
      const year = record.date.getFullYear()
      breakdown.set(year, (breakdown.get(year) ?? 0) + record.km)
    }
    return breakdown
  }
}
