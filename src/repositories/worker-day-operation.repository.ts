import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseCivilDate, toMoney } from '@/lib/daily-pay'
import { DailyPayRepository } from '@/repositories/daily-pay.repository'
import type { WorkerDayOperationInput } from '@/schemas/worker-day-operation.schema'

export class WorkerDayOperationRepository {
  private readonly days: DailyPayRepository
  constructor(private readonly organizationId: string, private readonly client: PrismaClient = prisma) {
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
      await tx.workerDayTruckSegment.create({
        data: { operationId: operation.id, organizationId: this.organizationId,
          truckId: segment.truckId, workDate: parseCivilDate(date), position: index + 1, share: segment.share,
          kilometers: segment.kilometers === undefined ? null : new Prisma.Decimal(segment.kilometers),
          incident: segment.incident ?? null },
      })
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
