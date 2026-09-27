import { WorkerDayOperationRepository } from '@/repositories/worker-day-operation.repository'
import type { WorkerDayOperationInput } from '@/schemas/worker-day-operation.schema'

export class WorkerDayOperationError extends Error {
  constructor(public readonly status: number, message: string) { super(message) }
}

function conflict(error: unknown): boolean {
  const code = (error as { code?: string } | null | undefined)?.code
  return code === 'P2002' || code === 'P2034' || (error instanceof Error && error.message.includes('40001'))
}

export class WorkerDayOperationService {
  private readonly repository: WorkerDayOperationRepository
  constructor(organizationId: string, repository?: WorkerDayOperationRepository) {
    this.repository = repository ?? new WorkerDayOperationRepository(organizationId)
  }

  async get(workerId: string, date: string) {
    return this.repository.runSerializable(async tx => {
      const worker = await this.repository.findWorker(workerId, tx)
      if (!worker) throw new WorkerDayOperationError(404, 'Worker not found')
      const day = await this.repository.findDay(workerId, date, tx)
      if (!day) throw new WorkerDayOperationError(404, 'Worked day not found')
      return WorkerDayOperationRepository.serialize(day)
    })
  }

  async put(workerId: string, date: string, input: WorkerDayOperationInput) {
    try {
      return await this.repository.runSerializable(async tx => {
        const control = await this.repository.acquireMonthControl(workerId, date, tx)
        if (!control) throw new WorkerDayOperationError(404, 'Worker not found')
        if (control.status === 'PAID') throw new WorkerDayOperationError(409, 'Month is marked PAID')
        if (!await this.repository.ownsTrucks(input.segments.map(s => s.truckId), tx)) {
          throw new WorkerDayOperationError(404, 'Truck not found')
        }
        const day = await this.repository.save(workerId, date, input, tx)
        if (!day) throw new WorkerDayOperationError(409, 'Positive daily rate required')
        return WorkerDayOperationRepository.serialize(day)
      })
    } catch (error) {
      if (conflict(error)) throw new WorkerDayOperationError(409, 'Truck or worker already booked for this date')
      throw error
    }
  }
}
