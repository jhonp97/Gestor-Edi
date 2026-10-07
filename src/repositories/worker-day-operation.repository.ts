import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseCivilDate, toMoney } from '@/lib/daily-pay'
import { DailyPayRepository } from '@/repositories/daily-pay.repository'
import type { WorkerDayOperationInput } from '@/schemas/worker-day-operation.schema'

export class ManualMileageConflictError extends Error {
  readonly code = 'MANUAL_MILEAGE_CONFLICT'
}

export class WorkerDayOperationRepository {
  private readonly days: DailyPayRepository
  constructor(private readonly organizationId: string, client: PrismaClient = prisma) {
    if (!organizationId) throw new Error('Organization is required')
    this.days = new DailyPayRepository(organizationId, client)
  }

  runSerializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.days.runSerializable(work)
  }

  acquireMonthControl(workerId: string, date: string, tx: Prisma.TransactionClient) {
    return this.days.acquireMonthControl(workerId, `${date.slice(0, 7)}-01`, tx)
  }

  findDay(workerId: string, date: string, tx: Prisma.TransactionClient) {
    return tx.dailyPayDay.findFirst({
      where: { workerId, organizationId: this.organizationId, workDate: parseCivilDate(date) },
      include: { operation: { include: { segments: { orderBy: { position: 'asc' } } } } },
    })
  }

  findWorker(workerId: string, tx: Prisma.TransactionClient) {
    return tx.worker.findFirst({ where: { id: workerId, organizationId: this.organizationId } })
  }

  async ownsTrucks(ids: string[], tx: Prisma.TransactionClient): Promise<boolean> {
    return await tx.truck.count({ where: { id: { in: ids }, organizationId: this.organizationId } }) === ids.length
  }

  async save(workerId: string, date: string, input: WorkerDayOperationInput, tx: Prisma.TransactionClient) {
    const workDate = parseCivilDate(date)
    for (const segment of input.segments) {
      if (segment.kilometers === undefined) continue
      const manualMileage = await tx.truckMileage.findFirst({
        where: { organizationId: this.organizationId, truckId: segment.truckId, date: workDate, sourceWorkerDaySegmentId: null },
        select: { id: true },
      })
      if (manualMileage) throw new ManualMileageConflictError('Manual mileage already exists for this truck and date')
    }

    let day = await this.findDay(workerId, date, tx)
    if (!day) {
      const worker = await this.findWorker(workerId, tx)
      if (!worker?.dailyRate || !new Prisma.Decimal(worker.dailyRate).greaterThan(0)) return null
      day = await tx.dailyPayDay.create({
        data: { workerId, workDate: parseCivilDate(date), organizationId: this.organizationId, rateSnapshot: worker.dailyRate },
        include: { operation: { include: { segments: { orderBy: { position: 'asc' } } } } },
      })
    }
    const operation = day.operation
      ? await tx.workerDayOperation.update({
          where: { id: day.operation.id }, data: { companyName: input.companyName },
        })
      : await tx.workerDayOperation.create({
          data: { dailyPayDayId: day.id, organizationId: this.organizationId, companyName: input.companyName },
        })
    // Remove old segments in the same transaction; the uniqueness constraint
    // continues to protect the entire civil day from competing workers.
    await tx.workerDayTruckSegment.deleteMany({ where: { operationId: operation.id, organizationId: this.organizationId } })
    for (const [index, segment] of input.segments.entries()) {
      const createdSegment = await tx.workerDayTruckSegment.create({
        data: { operationId: operation.id, organizationId: this.organizationId,
          truckId: segment.truckId, workDate, position: index + 1, share: segment.share,
          kilometers: segment.kilometers === undefined ? null : new Prisma.Decimal(segment.kilometers),
          incident: segment.incident ?? null },
      })
      if (createdSegment.kilometers !== null) {
        try {
          await tx.truckMileage.create({
            data: {
              organizationId: this.organizationId,
              truckId: createdSegment.truckId,
              date: createdSegment.workDate,
              km: createdSegment.kilometers.toNumber(),
              notes: null,
              sourceWorkerDaySegmentId: createdSegment.id,
            },
          })
        } catch (error) {
          if ((error as { code?: string } | null)?.code === 'P2002') {
            throw new ManualMileageConflictError('Manual mileage already exists for this truck and date')
          }
          throw error
        }
      }
    }
    return this.findDay(workerId, date, tx)
  }

  static serialize(day: NonNullable<Awaited<ReturnType<WorkerDayOperationRepository['findDay']>>>) {
    return { date: day.workDate.toISOString().slice(0, 10), rateSnapshot: toMoney(day.rateSnapshot),
      operation: day.operation ? { companyName: day.operation.companyName,
        segments: day.operation.segments.map(s => ({ truckId: s.truckId, share: s.share,
          kilometers: s.kilometers?.toString() ?? null, incident: s.incident })) } : null }
  }
}
