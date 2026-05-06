import { TruckMileageRepository } from '@/repositories/truck-mileage.repository'
import { createMileageSchema } from '@/schemas'
import type { CreateMileageInput } from '@/schemas'
import type { MileageHistoryResult } from '@/types'

export class TruckMileageService {
  constructor(private repo: TruckMileageRepository) {}

  async createMileage(data: CreateMileageInput & { organizationId: string }) {
    const validated = createMileageSchema.parse(data)

    // Check for duplicate
    const existing = await this.repo.findByTruckAndDate(validated.truckId, validated.date)
    if (existing) {
      throw Object.assign(new Error('Ya existe un registro de kilometraje para esta fecha'), { statusCode: 409 })
    }

    return this.repo.create({
      ...validated,
      organizationId: data.organizationId,
    })
  }

  async getMileageHistory(
    truckId: string,
    year?: number,
    month?: number
  ): Promise<MileageHistoryResult> {
    const records = await this.repo.findByTruck(truckId, { year, month })
    const totalKm = records.reduce((sum, r) => sum + r.km, 0)

    const result: MileageHistoryResult = {
      records: records.map((r) => ({
        id: r.id,
        date: r.date,
        km: r.km,
        notes: r.notes,
        createdAt: r.createdAt,
      })),
      totalKm,
    }

    if (year) {
      result.yearlyKm = await this.repo.getYearlyTotal(truckId, year)
    }
    if (year && month !== undefined) {
      result.monthlyKm = await this.repo.getMonthlyTotal(truckId, year, month)
    }

    return result
  }

  async getStats(truckId: string) {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const [totalKm, monthlyKm, yearlyKm] = await Promise.all([
      this.repo.getTotalKm(truckId),
      this.repo.getMonthlyTotal(truckId, currentYear, currentMonth),
      this.repo.getYearlyTotal(truckId, currentYear),
    ])

    return { totalKm, monthlyKm, yearlyKm }
  }

  async deleteMileage(id: string): Promise<void> {
    await this.repo.delete(id)
  }
}
