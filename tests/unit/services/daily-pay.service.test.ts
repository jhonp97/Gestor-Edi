import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

// El servicio compone el repositorio daily-pay y el repositorio de auditoría,
// que importan @/lib/prisma (construye PrismaClient al importarse); el módulo
// se sustituye porque en pruebas unitarias no hay DATABASE_URL. Cada prueba
// inyecta sus dobles vía el objeto de dependencias del servicio.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: { create: vi.fn() },
  },
}))

import {
  DailyPayService,
  DailyPayEmptyMonthError,
  DailyPayMonthNotFoundError,
  DailyPayTransitionConflictError,
  MAX_REVERT_REASON_LENGTH,
  monthEnd,
  sanitizeRevertReason,
} from '@/services/daily-pay.service'
import { AuditLogRepository } from '@/repositories/audit-log.repository'
import { AuditActionSchema, AuditLogCreateSchema } from '@/schemas/audit.schema'

const { prisma: db } = await import('@/lib/prisma')

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const WORKER_ID = 'worker-1'
const PERIOD = '2026-03-01'
const USER_ID = 'user-1'
const STAMP = new Date('2026-03-15T10:30:00.000Z')
const STAMP_ISO = STAMP.toISOString()
const MARKED_PAID = 'DAILY_PAY_MONTH_MARKED_PAID'
const MARKED_PENDING = 'DAILY_PAY_MONTH_MARKED_PENDING'

/** Cliente de transacción fingido: la única superficie que usa es auditLog. */
const tx = {
  auditLog: { create: vi.fn() },
} as unknown as Prisma.TransactionClient

type ControlFixture = {
  status: 'PENDING' | 'PAID'
  paidAt: Date | null
}

function makeControl(overrides: Partial<ControlFixture> = {}) {
  return {
    id: 'control-1',
    organizationId: ORG_A,
    workerId: WORKER_ID,
    periodStart: new Date(PERIOD),
    status: 'PENDING' as const,
    paidAt: null,
    ...overrides,
  }
}

/**
 * Construye el servicio con dobles de repositorio y auditoría. El closure de
 * runSerializable se ejecuta con el mismo cliente de transacción que luego se
 * debe observar en las llamadas de estado y de auditoría.
 */
function makeService(control: ReturnType<typeof makeControl> | null = makeControl()) {
  const repository = {
    runSerializable: vi.fn(async (work: (t: Prisma.TransactionClient) => Promise<unknown>) => work(tx)),
    findMonth: vi.fn().mockResolvedValue(control),
    acquireMonthControl: vi.fn().mockResolvedValue(control),
    countWorkedDays: vi.fn().mockResolvedValue(1),
    // Devuelve la fila actualizada (estado y paidAt de la llamada), como el
    // repositorio real: la misma clave única con los datos escritos.
    setMonthState: vi.fn(
      (
        _workerId: string,
        _period: string,
        status: 'PENDING' | 'PAID',
        paidAt: Date | null,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- tx is the caller's transaction client; the mock must accept it so the tests can assert it is passed.
        _tx?: unknown
      ) => Promise.resolve({ ...control, status, paidAt })
    ),
  }
  const auditRepository = { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) }
  const service = new DailyPayService(ORG_A, {
    repository: repository as unknown as never,
    auditRepository: auditRepository as unknown as never,
    now: () => STAMP,
  })
  return { service, repository, auditRepository }
}

describe('DailyPayService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('mark-paid', () => {
    it('debería marcar PAID un mes elegible estampando paidAt y auditando la transición', async () => {
      const { service, repository, auditRepository } = makeService(makeControl())
      const result = await service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })

      expect(result).toEqual({ status: 'PAID', paidAt: STAMP_ISO, transitioned: true })
      expect(repository.setMonthState).toHaveBeenCalledTimes(1)
      expect(repository.setMonthState).toHaveBeenCalledWith(WORKER_ID, PERIOD, 'PAID', STAMP, tx)

      expect(auditRepository.create).toHaveBeenCalledTimes(1)
      const [payload, client] = auditRepository.create.mock.calls[0]
      expect(payload.action).toBe(MARKED_PAID)
      expect(payload.userId).toBe(USER_ID)
      expect(payload.organizationId).toBe(ORG_A)
      expect(payload.details).toEqual({
        workerId: WORKER_ID,
        periodStart: PERIOD,
        transition: 'PENDING→PAID',
        previousPaidAt: null,
        newPaidAt: STAMP_ISO,
      })
      expect('reason' in payload.details).toBe(false)
      expect(client).toBe(tx)
    })

    it('debería usar un único cliente de transacción para el estado y la auditoría', async () => {
      const { service, repository, auditRepository } = makeService(makeControl())
      await service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })

      expect(repository.setMonthState.mock.calls[0][4]).toBe(tx)
      expect(auditRepository.create.mock.calls[0][1]).toBe(tx)
      expect(repository.acquireMonthControl.mock.calls[0][2]).toBe(tx)
      expect(repository.countWorkedDays.mock.calls[0][3]).toBe(tx)
    })

    it('debería exigir al menos un día trabajado en el mes objetivo', async () => {
      const { service, repository, auditRepository } = makeService(makeControl())
      repository.countWorkedDays.mockResolvedValue(0)

      await expect(service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })).rejects.toThrow(
        DailyPayEmptyMonthError
      )
      expect(repository.setMonthState).not.toHaveBeenCalled()
      expect(auditRepository.create).not.toHaveBeenCalled()
    })

    it('debería contar los días del mes completo (inicio a fin de mes)', async () => {
      const { service, repository } = makeService(makeControl())
      await service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })

      expect(repository.countWorkedDays).toHaveBeenCalledWith(WORKER_ID, '2026-03-01', '2026-03-31', tx)
    })

    it('no-op: marcar un mes ya PAID preserva el timestamp y no duplica auditoría', async () => {
      const { service, repository, auditRepository } = makeService(
        makeControl({ status: 'PAID', paidAt: STAMP })
      )
      const result = await service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })

      expect(result).toEqual({ status: 'PAID', paidAt: STAMP_ISO, transitioned: false })
      expect(repository.setMonthState).not.toHaveBeenCalled()
      expect(auditRepository.create).not.toHaveBeenCalled()
      expect(repository.countWorkedDays).not.toHaveBeenCalled()
    })

    it('no-op: repetir mark-paid es genuinamente libre de escritura (sin lock, sin estado, sin auditoría)', async () => {
      const { service, repository, auditRepository } = makeService(
        makeControl({ status: 'PAID', paidAt: STAMP })
      )
      const result = await service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })

      expect(result).toEqual({ status: 'PAID', paidAt: STAMP_ISO, transitioned: false })
      // El estado asentado se lee con el primitivo de solo lectura dentro de la
      // transacción serializable...
      expect(repository.findMonth).toHaveBeenCalledTimes(1)
      expect(repository.findMonth).toHaveBeenCalledWith(WORKER_ID, PERIOD, tx)
      // ...y ningún primitivo de escritura se invoca: ni el lock táctil (que
      // mutaría updatedAt), ni el estado, ni el conteo, ni la auditoría.
      expect(repository.acquireMonthControl).not.toHaveBeenCalled()
      expect(repository.setMonthState).not.toHaveBeenCalled()
      expect(repository.countWorkedDays).not.toHaveBeenCalled()
      expect(auditRepository.create).not.toHaveBeenCalled()
    })

    it('debería adquirir el lock de control dentro de la transición (protocolo del diseño)', async () => {
      const { service, repository } = makeService(makeControl())
      await service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })

      expect(repository.acquireMonthControl).toHaveBeenCalledTimes(1)
      expect(repository.acquireMonthControl).toHaveBeenCalledWith(WORKER_ID, PERIOD, tx)
    })
  })

  describe('revert', () => {
    it('debería revertir PAID a PENDING limpiando paidAt y auditando con la razón saneada', async () => {
      const { service, repository, auditRepository } = makeService(
        makeControl({ status: 'PAID', paidAt: STAMP })
      )
      const result = await service.revert(
        WORKER_ID,
        PERIOD,
        { userId: USER_ID },
        { reason: '  error\n de carga\tX ' }
      )

      expect(result).toEqual({ status: 'PENDING', paidAt: null, transitioned: true })
      expect(repository.setMonthState).toHaveBeenCalledWith(WORKER_ID, PERIOD, 'PENDING', null, tx)

      const [payload] = auditRepository.create.mock.calls[0]
      expect(payload.action).toBe(MARKED_PENDING)
      expect(payload.userId).toBe(USER_ID)
      expect(payload.organizationId).toBe(ORG_A)
      expect(payload.details).toEqual({
        workerId: WORKER_ID,
        periodStart: PERIOD,
        transition: 'PAID→PENDING',
        previousPaidAt: STAMP_ISO,
        newPaidAt: null,
        reason: 'error de carga X',
      })
    })

    it('debería limitar la longitud de la razón al máximo definido', async () => {
      const { service, auditRepository } = makeService(makeControl({ status: 'PAID', paidAt: STAMP }))
      await service.revert(WORKER_ID, PERIOD, { userId: USER_ID }, { reason: 'a'.repeat(300) })

      const [payload] = auditRepository.create.mock.calls[0]
      expect((payload.details.reason as string).length).toBe(MAX_REVERT_REASON_LENGTH)
    })

    it('debería omitir la razón cuando queda vacía tras sanear', async () => {
      const { service, auditRepository } = makeService(makeControl({ status: 'PAID', paidAt: STAMP }))
      await service.revert(WORKER_ID, PERIOD, { userId: USER_ID }, { reason: ' \n\t ' })

      const [payload] = auditRepository.create.mock.calls[0]
      expect('reason' in payload.details).toBe(false)
    })

    it('debería auditar sin razón cuando el comando no la provee', async () => {
      const { service, auditRepository } = makeService(makeControl({ status: 'PAID', paidAt: STAMP }))
      await service.revert(WORKER_ID, PERIOD, { userId: USER_ID })

      const [payload] = auditRepository.create.mock.calls[0]
      expect('reason' in payload.details).toBe(false)
    })

    it('no-op: revertir un mes ya PENDING no escribe estado ni audita', async () => {
      const { service, repository, auditRepository } = makeService(makeControl())
      const result = await service.revert(WORKER_ID, PERIOD, { userId: USER_ID })

      expect(result).toEqual({ status: 'PENDING', paidAt: null, transitioned: false })
      expect(repository.setMonthState).not.toHaveBeenCalled()
      expect(auditRepository.create).not.toHaveBeenCalled()
    })

    it('no-op: repetir la reversa es genuinamente libre de escritura (sin lock, sin estado, sin auditoría)', async () => {
      const { service, repository, auditRepository } = makeService(makeControl())
      const result = await service.revert(WORKER_ID, PERIOD, { userId: USER_ID })

      expect(result).toEqual({ status: 'PENDING', paidAt: null, transitioned: false })
      // Mismo contrato que el no-op de marcaje: lectura de estado sin lock
      // táctil ni escritura de estado ni auditoría.
      expect(repository.findMonth).toHaveBeenCalledTimes(1)
      expect(repository.findMonth).toHaveBeenCalledWith(WORKER_ID, PERIOD, tx)
      expect(repository.acquireMonthControl).not.toHaveBeenCalled()
      expect(repository.setMonthState).not.toHaveBeenCalled()
      expect(auditRepository.create).not.toHaveBeenCalled()
    })
  })

  describe('tenencia sin bypass', () => {
    it('debería resolver como no encontrado un worker ajeno a la organización', async () => {
      const { service, repository, auditRepository } = makeService(null)
      repository.acquireMonthControl.mockResolvedValue(null)

      await expect(service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })).rejects.toThrow(
        DailyPayMonthNotFoundError
      )
      await expect(service.revert(WORKER_ID, PERIOD, { userId: USER_ID })).rejects.toThrow(
        DailyPayMonthNotFoundError
      )
      expect(repository.setMonthState).not.toHaveBeenCalled()
      expect(auditRepository.create).not.toHaveBeenCalled()
    })

    it('no debería exponer rol ni actor que burle la tenencia (sin bypass PLATFORM_ADMIN)', async () => {
      const proto = Object.getOwnPropertyNames(DailyPayService.prototype)
      expect(proto.filter((name) => /admin|role|bypass|actor|platform/i.test(name))).toEqual([])

      // Un servicio construido para otra organización sigue sin ver el worker.
      const foreignRepository = {
        runSerializable: vi.fn(async (work: (t: Prisma.TransactionClient) => Promise<unknown>) => work(tx)),
        findMonth: vi.fn().mockResolvedValue(null),
        acquireMonthControl: vi.fn().mockResolvedValue(null),
      }
      const foreignAudit = { create: vi.fn() }
      const foreignService = new DailyPayService(ORG_B, {
        repository: foreignRepository as unknown as never,
        auditRepository: foreignAudit as unknown as never,
      })
      await expect(foreignService.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })).rejects.toThrow(
        DailyPayMonthNotFoundError
      )
      expect(foreignAudit.create).not.toHaveBeenCalled()
    })
  })

  describe('reintentos acotados', () => {
    it('debería mapear el agotamiento serializable a un conflicto de transición', async () => {
      const { service, repository } = makeService(makeControl())
      const p2034 = Object.assign(new Error('Transaction failed due to a write conflict or a deadlock'), {
        code: 'P2034',
      })
      repository.runSerializable.mockRejectedValue(p2034)

      await expect(service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })).rejects.toThrow(
        DailyPayTransitionConflictError
      )
    })

    it('no debería duplicar la capa de reintentos: una sola ejecución serializable por comando', async () => {
      const { service, repository } = makeService(makeControl())
      await service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID })

      expect(repository.runSerializable).toHaveBeenCalledTimes(1)
    })

    it('no debería mapear errores ajenos a serialización (la falla de auditoría se propaga)', async () => {
      const { service, auditRepository } = makeService(makeControl())
      const auditFailure = new Error('FK violation on AuditLog_userId_fkey')
      auditRepository.create.mockRejectedValue(auditFailure)

      const error = await service.markPaid(WORKER_ID, PERIOD, { userId: USER_ID }).then(
        () => null,
        (caught: unknown) => caught
      )
      expect(error).toBe(auditFailure)
      expect(error).not.toBeInstanceOf(DailyPayTransitionConflictError)
    })
  })

  describe('sanitización de la razón (funciones puras)', () => {
    it('debería colapsar saltos de línea y controles de registro en un solo espacio', () => {
      expect(sanitizeRevertReason('error\nde\r\ncarga')).toBe('error de carga')
      expect(sanitizeRevertReason('inyección\u0000de\u001Fcontrol')).toBe('inyección de control')
    })

    it('debería recortar espacios y devolver undefined para razones vacías', () => {
      expect(sanitizeRevertReason('   ya  revisado   ')).toBe('ya revisado')
      expect(sanitizeRevertReason(' \t\n ')).toBeUndefined()
      expect(sanitizeRevertReason('')).toBeUndefined()
    })

    it('debería acotar la razón al máximo definido', () => {
      expect(sanitizeRevertReason('x'.repeat(1000))!.length).toBe(MAX_REVERT_REASON_LENGTH)
    })
  })

  describe('fin de mes (función pura)', () => {
    it('debería devolver el último día civil del mes del período', () => {
      expect(monthEnd('2026-01-01')).toBe('2026-01-31')
      expect(monthEnd('2026-02-01')).toBe('2026-02-28')
      expect(monthEnd('2024-02-01')).toBe('2024-02-29')
      expect(monthEnd('2026-03-01')).toBe('2026-03-31')
      expect(monthEnd('2026-12-01')).toBe('2026-12-31')
    })
  })

  describe('contrato del esquema de auditoría (2.5b)', () => {
    it('debería aceptar las nuevas acciones DAILY_PAY_MONTH_MARKED_* en el enum de auditoría', () => {
      expect(AuditActionSchema.safeParse(MARKED_PAID).success).toBe(true)
      expect(AuditActionSchema.safeParse(MARKED_PENDING).success).toBe(true)
    })

    it('debería validar un payload completo de auditoría de transición', () => {
      const parsed = AuditLogCreateSchema.safeParse({
        action: MARKED_PAID,
        userId: USER_ID,
        organizationId: ORG_A,
        details: {
          workerId: WORKER_ID,
          periodStart: PERIOD,
          transition: 'PENDING→PAID',
          previousPaidAt: null,
          newPaidAt: STAMP_ISO,
        },
      })
      expect(parsed.success).toBe(true)
    })

    it('debería permitir al repositorio de auditoría escribir dentro de la transacción del llamador', async () => {
      const repository = new AuditLogRepository()
      await repository.create({ action: MARKED_PAID as never, userId: USER_ID, organizationId: ORG_A, details: {} }, tx)

      expect(tx.auditLog.create).toHaveBeenCalledTimes(1)
      expect(db.auditLog.create).not.toHaveBeenCalled()
    })
  })
})
