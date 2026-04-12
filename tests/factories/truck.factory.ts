import type { Truck } from '@prisma/client'

let truckCounter = 0

export function createTruck(overrides: Partial<Truck> = {}): Truck {
  truckCounter++
  return {
    id: overrides.id ?? `truck-${truckCounter}`,
    plate: overrides.plate ?? `ABC-${1000 + truckCounter}`,
    brand: overrides.brand ?? 'Mercedes',
    model: overrides.model ?? 'Actros',
    year: overrides.year ?? 2020,
    status: overrides.status ?? 'ACTIVE',
    organizationId: overrides.organizationId ?? 'test-org-id',
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

export function createTruckInput(overrides: Partial<Truck> = {}) {
  return {
    plate: 'DEF-2000',
    brand: 'Volvo',
    model: 'FH16',
    year: 2022,
    ...overrides,
  }
}
