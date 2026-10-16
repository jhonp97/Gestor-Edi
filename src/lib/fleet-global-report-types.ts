export type FleetGlobalPeriod = 'month' | 'quarter' | 'half-year' | 'year'

export type FleetGlobalReport = {
  month: string
  period: FleetGlobalPeriod
  periodLabel: string
  trucks: { id: string; plate: string; operationalDays: number; equivalentDays: string; kilometers: string; fuelExpense: string }[]
  workers: { id: string; name: string; days: number; equivalentDays: string }[]
  companies: { name: string; truckDays: number; workerDays: number; equivalentDays: string }[]
  mileageDays: { truckId: string; plate: string; date: string; kilometers: number; companyName: string | null }[]
  mileageCompanies: { companyName: string | null; truckDays: number }[]
  totals: { truckDays: number; calendarDays: number; workerDays: number; equivalentDays: string; fuelExpense: string }
}
