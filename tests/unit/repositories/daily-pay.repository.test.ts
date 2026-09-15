import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

// Sin delegates de pagos: su ausencia es parte de la prueba de remoción.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    worker: { findFirst: vi.fn(), update: vi.fn() },
    dailyPayDay: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    dailyPayMonthControl: { findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { DailyPayRepository } from '@/repositories/daily-pay.repository'
import { DailyPayDateError, parseCivilDate } from '@/lib/daily-pay'

const { prisma: db } = await import('@/lib/prisma')

const ORG_A = 'org-a'
const workerRow = { id: 'worker-1', organizationId: ORG_A }
const STAMP = new Date('2026-09-01T12:00:00.000Z')
const tx = {
  worker: { findFirst: vi.fn() },
  dailyPayDay: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  dailyPayMonthControl: { findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn() },
} as unknown as Prisma.TransactionClient
const utc = (civil: string) => parseCivilDate(civil)
const p2034 = Object.assign(new Error('Transaction failed due to a write conflict or a deadlock'), { code: 'P2034' })
const sqlState40001 = new Error('could not serialize access due to concurrent update, SQLSTATE 40001')

describe('DailyPayRepository', () => {
  let repo: DailyPayRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new DailyPayRepository(ORG_A)
  })

  describe('construcción', () => {
    it('debería exigir organizationId estructuralmente', () => {
      const Ctor = DailyPayRepository as unknown as new (org?: unknown) => DailyPayRepository
      expect(() => new Ctor()).toThrow()
      expect(() => new Ctor(null)).toThrow()
      expect(() => new Ctor('')).toThrow()
    })

    it('no debería exponer ningún método de pago', () => {
      const surface = repo as unknown as Record<string, unknown>
      for (const method of ['createPayment', 'listPayments', 'aggregatePayments', 'updatePayment', 'deletePayment']) {
        expect(surface[method]).toBeUndefined()
      }
    })

    it('no debería aceptar rol ni actor que burle la tenencia (sin bypass PLATFORM_ADMIN)', () => {
      const proto = Object.getOwnPropertyNames(DailyPayRepository.prototype)
      expect(proto.filter((name) => /admin|role|bypass|actor|platform/i.test(name))).toEqual([])
    })
  })

  describe('worker', () => {
    it('debería resolver el worker con predicado de organización en la consulta', async () => {
      vi.mocked(db.worker.findFirst).mockResolvedValue(workerRow as never)
      expect(await repo.findWorker('worker-1')).toEqual(workerRow)
      expect(db.worker.findFirst).toHaveBeenCalledWith({
        where: { id: 'worker-1', organizationId: ORG_A },
      })
    })

    it('debería resolver null para un worker de otra organización (sin bypass PLATFORM_ADMIN)', async () => {
      vi.mocked(db.worker.findFirst).mockResolvedValue(null)
      expect(await repo.findWorker('worker-other-org')).toBeNull()
      expect(db.worker.findFirst).toHaveBeenCalledWith({
        where: { id: 'worker-other-org', organizationId: ORG_A },
      })
    })

    it('debería fijar y limpiar la tarifa dentro del alcance', async () => {
      vi.mocked(db.worker.findFirst).mockResolvedValue(workerRow as never)
      vi.mocked(db.worker.update).mockResolvedValue(workerRow as never)
      await repo.setDailyRate('worker-1', '100.00')
      expect(db.worker.update).toHaveBeenCalledWith({
        where: { id: 'worker-1' },
        data: { dailyRate: new Prisma.Decimal('100.00') },
      })
      await repo.setDailyRate('worker-1', null)
      expect(db.worker.update).toHaveBeenCalledWith({
        where: { id: 'worker-1' },
        data: { dailyRate: null },
      })
    })

    it('debería devolver null sin actualizar si el worker está fuera de alcance', async () => {
      vi.mocked(db.worker.findFirst).mockResolvedValue(null)
      expect(await repo.setDailyRate('worker-other-org', '1.00')).toBeNull()
      expect(db.worker.update).not.toHaveBeenCalled()
    })
  })

  describe('días trabajados (ámbito de transacción)', () => {
    it('debería marcar un día vía tx con fecha civil UTC y snapshot Decimal tras verificar alcance en la misma tx', async () => {
      vi.mocked(tx.worker.findFirst).mockResolvedValue(workerRow as never)
      vi.mocked(tx.dailyPayDay.create).mockResolvedValue({ id: 'day-1' } as never)
      expect(await repo.createDay('worker-1', '2026-08-03', '100.25', tx)).toEqual({ id: 'day-1' })
      expect(tx.worker.findFirst).toHaveBeenCalledWith({
        where: { id: 'worker-1', organizationId: ORG_A },
      })
      expect(tx.dailyPayDay.create).toHaveBeenCalledWith({
        data: {
          workerId: 'worker-1',
          organizationId: ORG_A,
          workDate: utc('2026-08-03'),
          rateSnapshot: new Prisma.Decimal('100.25'),
        },
      })
      expect(db.dailyPayDay.create).not.toHaveBeenCalled()
    })

    it('debería rechazar fechas no civiles sin tocar la base', async () => {
      await expect(repo.createDay('worker-1', '2026-02-30', '1.00', tx)).rejects.toThrow(DailyPayDateError)
      expect(tx.worker.findFirst).not.toHaveBeenCalled()
      expect(tx.dailyPayDay.create).not.toHaveBeenCalled()
    })

    it('debería negar el marcado de un worker fuera de alcance', async () => {
      vi.mocked(tx.worker.findFirst).mockResolvedValue(null)
      expect(await repo.createDay('worker-other-org', '2026-08-03', '1.00', tx)).toBeNull()
      expect(tx.dailyPayDay.create).not.toHaveBeenCalled()
    })

    it('debería desmarcar solo días del alcance vía tx y devolver el conteo', async () => {
      vi.mocked(tx.dailyPayDay.deleteMany).mockResolvedValue({ count: 1 } as never)
      expect(await repo.deleteDay('worker-1', '2026-08-03', tx)).toBe(1)
      expect(tx.dailyPayDay.deleteMany).toHaveBeenCalledWith({
        where: { workerId: 'worker-1', organizationId: ORG_A, workDate: utc('2026-08-03') },
      })
    })

    it('debería listar días del rango civil con alcance vía tx', async () => {
      vi.mocked(tx.dailyPayDay.findMany).mockResolvedValue([workerRow] as never)
      expect(await repo.listDays('worker-1', '2026-08-01', '2026-08-31', tx)).toEqual([workerRow])
      expect(tx.dailyPayDay.findMany).toHaveBeenCalledWith({
        where: {
          workerId: 'worker-1',
          organizationId: ORG_A,
          workDate: { gte: utc('2026-08-01'), lte: utc('2026-08-31') },
        },
        orderBy: { workDate: 'asc' },
      })
    })

    it('debería contar días trabajados del alcance vía tx', async () => {
      vi.mocked(tx.dailyPayDay.count).mockResolvedValue(3)
      expect(await repo.countWorkedDays('worker-1', '2026-08-01', '2026-08-31', tx)).toBe(3)
      expect(tx.dailyPayDay.count).toHaveBeenCalledWith({
        where: {
          workerId: 'worker-1',
          organizationId: ORG_A,
          workDate: { gte: utc('2026-08-01'), lte: utc('2026-08-31') },
        },
      })
    })
  })

  describe('devengo exacto', () => {
    it('debería sumar snapshots como Decimal exacto del alcance vía tx', async () => {
      vi.mocked(tx.dailyPayDay.aggregate).mockResolvedValue({
        _count: 3,
        _sum: { rateSnapshot: new Prisma.Decimal('300.75') },
      } as never)
      expect(await repo.aggregateWorkedDays('worker-1', '2026-08-01', '2026-08-31', tx)).toEqual({
        count: 3,
        accrued: '300.75',
      })
      expect(tx.dailyPayDay.aggregate).toHaveBeenCalledWith({
        where: {
          workerId: 'worker-1',
          organizationId: ORG_A,
          workDate: { gte: utc('2026-08-01'), lte: utc('2026-08-31') },
        },
        _count: true,
        _sum: { rateSnapshot: true },
      })
    })

    it('debería tratar la suma vacía como 0.00', async () => {
      vi.mocked(tx.dailyPayDay.aggregate).mockResolvedValue({
        _count: 0,
        _sum: { rateSnapshot: null },
      } as never)
      expect(await repo.aggregateWorkedDays('worker-1', '2026-08-01', '2026-08-31', tx)).toEqual({
        count: 0,
        accrued: '0.00',
      })
    })
  })

  describe('control de mes (marcador PENDING|PAID)', () => {
    it('debería encontrar el mes con predicado de organización vía tx', async () => {
      vi.mocked(tx.dailyPayMonthControl.findFirst).mockResolvedValue(null)
      await repo.findMonth('worker-1', '2026-08-01', tx)
      expect(tx.dailyPayMonthControl.findFirst).toHaveBeenCalledWith({
        where: { organizationId: ORG_A, workerId: 'worker-1', periodStart: utc('2026-08-01') },
      })
    })

    it('debería adquirir el control como PENDING con la clave única de tenant vía tx', async () => {
      const row = { id: 'control-1', status: 'PENDING', paidAt: null }
      vi.mocked(tx.worker.findFirst).mockResolvedValue(workerRow as never)
      vi.mocked(tx.dailyPayMonthControl.upsert).mockResolvedValue(row as never)
      expect(await repo.acquireMonthControl('worker-1', '2026-08-01', tx)).toBe(row)
      expect(tx.dailyPayMonthControl.upsert).toHaveBeenCalledWith({
        where: {
          organizationId_workerId_periodStart: {
            organizationId: ORG_A,
            workerId: 'worker-1',
            periodStart: utc('2026-08-01'),
          },
        },
        create: {
          organizationId: ORG_A,
          workerId: 'worker-1',
          periodStart: utc('2026-08-01'),
          status: 'PENDING',
        },
        update: expect.objectContaining({ updatedAt: expect.any(Date) }),
      })
      expect(db.dailyPayMonthControl.upsert).not.toHaveBeenCalled()
      // La prueba de pertenencia corre dentro de la misma tx, nunca en el cliente desnudo.
      expect(tx.worker.findFirst).toHaveBeenCalledWith({
        where: { id: 'worker-1', organizationId: ORG_A },
      })
      expect(db.worker.findFirst).not.toHaveBeenCalled()
    })

    it('debería adquirir de forma idempotente: dos adquisiciones usan la misma clave única sin cambiar el estado', async () => {
      vi.mocked(tx.worker.findFirst).mockResolvedValue(workerRow as never)
      vi.mocked(tx.dailyPayMonthControl.upsert).mockResolvedValue({ id: 'control-1' } as never)
      await repo.acquireMonthControl('worker-1', '2026-08-01', tx)
      await repo.acquireMonthControl('worker-1', '2026-08-01', tx)
      const calls = vi.mocked(tx.dailyPayMonthControl.upsert).mock.calls as unknown as Array<[{ where: object; create: object; update: object }]>
      expect(calls).toHaveLength(2)
      expect(calls[0][0].where).toEqual(calls[1][0].where)
      expect(calls[1][0].create).toEqual({ organizationId: ORG_A, workerId: 'worker-1', periodStart: utc('2026-08-01'), status: 'PENDING' })
      expect(calls[1][0].update).not.toHaveProperty('status')
      expect(calls[1][0].update).not.toHaveProperty('paidAt')
    })

    it('debería negar la adquisición de un worker ajeno al tenant antes del upsert (control cero)', async () => {
      vi.mocked(tx.worker.findFirst).mockResolvedValue(null)
      expect(await repo.acquireMonthControl('worker-foreign-org', '2026-08-01', tx)).toBeNull()
      expect(tx.worker.findFirst).toHaveBeenCalledWith({
        where: { id: 'worker-foreign-org', organizationId: ORG_A },
      })
      expect(tx.dailyPayMonthControl.upsert).not.toHaveBeenCalled()
      expect(db.dailyPayMonthControl.upsert).not.toHaveBeenCalled()
    })

    it('debería marcar PAID estampando paidAt junto al estado vía tx', async () => {
      vi.mocked(tx.dailyPayMonthControl.update).mockResolvedValue({ status: 'PAID' } as never)
      expect((await repo.setMonthState('worker-1', '2026-08-01', 'PAID', STAMP, tx))?.status).toBe('PAID')
      expect(tx.dailyPayMonthControl.update).toHaveBeenCalledWith({
        where: {
          organizationId_workerId_periodStart: {
            organizationId: ORG_A,
            workerId: 'worker-1',
            periodStart: utc('2026-08-01'),
          },
        },
        data: { status: 'PAID', paidAt: STAMP },
      })
    })

    it('debería volver a PENDING limpiando paidAt vía tx (ida y vuelta del marcador)', async () => {
      vi.mocked(tx.dailyPayMonthControl.update).mockResolvedValue({ status: 'PENDING' } as never)
      expect((await repo.setMonthState('worker-1', '2026-08-01', 'PENDING', null, tx))?.status).toBe('PENDING')
      expect(tx.dailyPayMonthControl.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PENDING', paidAt: null } })
      )
    })

    it('debería escribir estado y paidAt juntos (la CHECK de la base valida la pareja)', async () => {
      vi.mocked(tx.dailyPayMonthControl.update).mockResolvedValue({ status: 'PAID' } as never)
      await repo.setMonthState('worker-1', '2026-08-01', 'PAID', STAMP, tx)
      const data = vi.mocked(tx.dailyPayMonthControl.update).mock.calls[0][0] as { data: object }
      expect(Object.keys(data.data).sort()).toEqual(['paidAt', 'status'])
    })

    it('debería ser idempotente en el mismo estado: repetir la escritura produce los mismos datos', async () => {
      vi.mocked(tx.dailyPayMonthControl.update).mockResolvedValue({ status: 'PAID' } as never)
      await repo.setMonthState('worker-1', '2026-08-01', 'PAID', STAMP, tx)
      await repo.setMonthState('worker-1', '2026-08-01', 'PAID', STAMP, tx)
      const calls = vi.mocked(tx.dailyPayMonthControl.update).mock.calls as unknown as Array<[{ data: object }]>
      expect(calls).toHaveLength(2)
      expect(calls[0][0].data).toEqual(calls[1][0].data)
    })
  })

  describe('transacción Serializable con reintento acotado', () => {
    it('debería ejecutar la unidad de trabajo en transacción Serializable', async () => {
      const work = vi.fn().mockResolvedValue('ok')
      ;(db.$transaction as any).mockImplementation(async (fn: (v: string) => Promise<string>) => fn('TX'))
      expect(await repo.runSerializable(work)).toBe('ok')
      expect(work).toHaveBeenCalledWith('TX')
      expect(db.$transaction).toHaveBeenCalledWith(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    })

    it('debería reintentar P2034 hasta tres intentos y resolver', async () => {
      let attempts = 0
      // P2034 se manifiesta al confirmar: el trabajo se ejecuta en cada intento.
      ;(db.$transaction as any).mockImplementation(async (fn: (v: string) => Promise<string>) => {
        attempts += 1
        const result = await fn('TX-attempt')
        if (attempts <= 2) throw p2034
        return result
      })
      const work = vi.fn(async (v: unknown) => v)
      expect(await repo.runSerializable(work)).toBe('TX-attempt')
      expect(db.$transaction).toHaveBeenCalledTimes(3)
      expect(work).toHaveBeenCalledTimes(3)
    })

    it('debería reintentar fallos SQLSTATE 40001', async () => {
      let attempts = 0
      ;(db.$transaction as any).mockImplementation(async (fn: (v: string) => Promise<string>) => {
        attempts += 1
        if (attempts === 1) throw sqlState40001
        return fn('TX-40001')
      })
      expect(await repo.runSerializable(async (v: unknown) => v)).toBe('TX-40001')
      expect(db.$transaction).toHaveBeenCalledTimes(2)
    })

    it('no debería reintentar errores ajenos a la serialización', async () => {
      ;(db.$transaction as any).mockRejectedValue(new Error('boom'))
      await expect(repo.runSerializable(async () => 'x')).rejects.toThrow('boom')
      expect(db.$transaction).toHaveBeenCalledTimes(1)
    })

    it('debería agotar tres intentos ante P2034 persistente y propagar el error', async () => {
      ;(db.$transaction as any).mockRejectedValue(p2034)
      await expect(repo.runSerializable(async () => 'x')).rejects.toMatchObject({ code: 'P2034' })
      expect(db.$transaction).toHaveBeenCalledTimes(3)
    })
  })

  describe('mes PAID bloquea la edición de días (REFACTOR 2.3a)', () => {
    /** Flujo de edición documentado en el diseño: lock → conflicto si PAID → escritura. */
    const editDay = async (control: { status: string } | null) => {
      if (!control || control.status === 'PAID') return null
      return repo.createDay('worker-1', '2026-08-03', '100.25', tx)
    }

    it('debería exponer PAID dentro del lock para conflictuar la edición antes de escribir', async () => {
      vi.mocked(tx.worker.findFirst).mockResolvedValue(workerRow as never)
      vi.mocked(tx.dailyPayMonthControl.upsert).mockResolvedValue({ status: 'PAID', paidAt: STAMP } as never)
      const control = await repo.acquireMonthControl('worker-1', '2026-08-01', tx)
      expect(control?.status).toBe('PAID')
      expect(await editDay(control)).toBeNull()
      expect(tx.dailyPayDay.create).not.toHaveBeenCalled()
    })

    it('debería escribir el día vía tx cuando el control adquirido está PENDING', async () => {
      vi.mocked(tx.dailyPayMonthControl.upsert).mockResolvedValue({ status: 'PENDING', paidAt: null } as never)
      vi.mocked(tx.worker.findFirst).mockResolvedValue(workerRow as never)
      vi.mocked(tx.dailyPayDay.create).mockResolvedValue({ id: 'day-1' } as never)
      const control = await repo.acquireMonthControl('worker-1', '2026-08-01', tx)
      expect(await editDay(control)).toEqual({ id: 'day-1' })
      expect(tx.dailyPayDay.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: ORG_A }) })
      )
    })
  })

  describe('trazabilidad del marcador y predicados (REFACTOR 2.3a)', () => {
    it('debería completar la ida y vuelta PAID→PENDING→PAID en la misma transacción', async () => {
      const T1 = new Date('2026-09-01T12:00:00.000Z')
      const T2 = new Date('2026-09-02T08:30:00.000Z')
      vi.mocked(tx.dailyPayMonthControl.update).mockResolvedValue({ status: 'PAID' } as never)
      await repo.setMonthState('worker-1', '2026-08-01', 'PAID', T1, tx)
      await repo.setMonthState('worker-1', '2026-08-01', 'PENDING', null, tx)
      await repo.setMonthState('worker-1', '2026-08-01', 'PAID', T2, tx)
      const datas = (vi.mocked(tx.dailyPayMonthControl.update).mock.calls as unknown as Array<[{ data: { status: string; paidAt: Date | null } }]>)
        .map((call) => call[0].data)
      expect(datas).toEqual([
        { status: 'PAID', paidAt: T1 },
        { status: 'PENDING', paidAt: null },
        { status: 'PAID', paidAt: T2 },
      ])
    })

    it('no debería derivar el alcance del workerId en ningún primitivo de días', async () => {
      const foreign = 'worker-foreign-org'
      vi.mocked(tx.dailyPayDay.deleteMany).mockResolvedValue({ count: 0 } as never)
      vi.mocked(tx.dailyPayDay.findMany).mockResolvedValue([] as never)
      vi.mocked(tx.dailyPayDay.count).mockResolvedValue(0)
      vi.mocked(tx.dailyPayDay.aggregate).mockResolvedValue({ _count: 0, _sum: { rateSnapshot: null } } as never)
      await repo.deleteDay(foreign, '2026-08-03', tx)
      await repo.listDays(foreign, '2026-08-01', '2026-08-31', tx)
      await repo.countWorkedDays(foreign, '2026-08-01', '2026-08-31', tx)
      await repo.aggregateWorkedDays(foreign, '2026-08-01', '2026-08-31', tx)
      for (const mock of [tx.dailyPayDay.deleteMany, tx.dailyPayDay.findMany, tx.dailyPayDay.count, tx.dailyPayDay.aggregate]) {
        expect(mock).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_A, workerId: foreign }) })
        )
      }
    })

    it('debería localizar el mes por la clave compuesta de tenant en lectura y escritura', async () => {
      vi.mocked(tx.dailyPayMonthControl.findFirst).mockResolvedValue(null)
      vi.mocked(tx.dailyPayMonthControl.update).mockResolvedValue({ status: 'PENDING' } as never)
      await repo.findMonth('worker-1', '2026-08-01', tx)
      await repo.setMonthState('worker-1', '2026-08-01', 'PENDING', null, tx)
      const expectedWhere = {
        organizationId_workerId_periodStart: {
          organizationId: ORG_A,
          workerId: 'worker-1',
          periodStart: utc('2026-08-01'),
        },
      }
      expect(tx.dailyPayMonthControl.update).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }))
      expect(tx.dailyPayMonthControl.findFirst).toHaveBeenCalledWith({
        where: { organizationId: ORG_A, workerId: 'worker-1', periodStart: utc('2026-08-01') },
      })
    })
  })
})
