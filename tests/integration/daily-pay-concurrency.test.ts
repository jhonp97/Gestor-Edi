// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { Prisma, type AuditAction, PrismaClient } from '@prisma/client'
import { DailyPayRepository } from '@/repositories/daily-pay.repository'
import { annualHistoryMonths } from '@/lib/daily-pay'
import type { DailyPayHistoryMonthDTO } from '@/types/daily-pay'
import {
  DailyPayService,
  DailyPayEmptyMonthError,
  DailyPayMonthNotFoundError,
  monthEnd,
} from '@/services/daily-pay.service'

/** count() sobre el alcance de organizaciones, tipado para los loops de limpieza. */
type OrgScopedCountDelegate = {
  count(args: { where: { organizationId: { in: string[] } } }): Promise<number>
}

// El repositorio importa @/lib/prisma, que construye PrismaClient al importarse
// con la DATABASE_URL del entorno; en Vitest esa variable no existe, así que el
// módulo se sustituye y cada prueba de base de datos inyecta su cliente propio
// vía el constructor del repositorio.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

// Contrato DB del work unit R1 (schema/CHECK/migración) de worker-daily-pay-tracking.
// Modelo enmendado: marcador mensual PENDING|PAID con paidAt nullable y CHECK de
// autoría manual; sin DailyPayPayment ni contabilidad de pagos. Verifica el
// datamodel Prisma y el SQL de migración 20260902180000 (remediado in situ),
// incluido el contrato TM-PROC del harness: gate de huella, no divulgación de
// credenciales y stop sin DDL ante un target equivocado. La verificación runtime
// (migrate deploy + estructura real + probes CHECK) se ejecuta como harness contra
// PostgreSQL desechable, fuera de esta suite.

const schemaPath = join(process.cwd(), 'prisma/schema.prisma')
const migrationPath = join(
  process.cwd(),
  'prisma/migrations/20260902180000_add_worker_daily_pay/migration.sql'
)

function readSchema(): string {
  return readFileSync(schemaPath, 'utf-8')
}

function blockOf(content: string, header: string): string | null {
  const start = content.indexOf(header)
  if (start === -1) return null
  const braceStart = content.indexOf('{', start)
  let depth = 0
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === '{') depth++
    if (content[i] === '}') {
      depth--
      if (depth === 0) return content.substring(start, i + 1)
    }
  }
  return null
}

function firstDdlIndex(sql: string): number {
  return Math.min(
    ...['CREATE TYPE', 'CREATE TABLE', 'ALTER TABLE']
      .map((token) => sql.indexOf(token))
      .filter((idx) => idx !== -1)
  )
}

describe('R1: contrato DB de pago diario por trabajador', () => {
  const schema = readSchema()

  describe('Contrato de marcador mensual (PENDING|PAID + paidAt)', () => {
    it('no debería contener el modelo DailyPayPayment en el schema', () => {
      expect(schema).not.toContain('model DailyPayPayment')
    })

    it('debería tener el enum DailyPayMonthStatus con PENDING y PAID únicamente', () => {
      const statusEnum = blockOf(schema, 'enum DailyPayMonthStatus')
      expect(statusEnum).not.toBeNull()
      expect(statusEnum).toMatch(/\bPENDING\b/)
      expect(statusEnum).toMatch(/\bPAID\b/)
      expect(statusEnum).not.toMatch(/\bOPEN\b|\bCLOSED\b/)
    })

    it('debería iniciar PENDING con paidAt nullable en DailyPayMonthControl', () => {
      const control = blockOf(schema, 'model DailyPayMonthControl')
      expect(control).not.toBeNull()
      expect(control).toMatch(/status\s+DailyPayMonthStatus\s+@default\(PENDING\)/)
      expect(control).toMatch(/paidAt\s+DateTime\?/)
    })

    it('debería exponer días y meses desde Worker/Organization sin relaciones de pagos', () => {
      for (const header of ['model Worker', 'model Organization']) {
        const block = blockOf(schema, header)
        expect(block).not.toBeNull()
        expect(block).toMatch(/dailyPayDays\s+DailyPayDay\[\]/)
        expect(block).toMatch(/dailyPayMonths\s+DailyPayMonthControl\[\]/)
        expect(block).not.toMatch(/dailyPayPayments/)
      }
    })
  })

  describe('Invariante de estado en SQL (CHECK de autoría manual)', () => {
    it('debería declarar el CHECK daily_pay_month_status_paid_at_consistency', () => {
      const sql = readFileSync(migrationPath, 'utf-8')
      expect(sql).toContain('CONSTRAINT "daily_pay_month_status_paid_at_consistency" CHECK')
      expect(sql).toContain(`"status" = 'PAID' AND "paidAt" IS NOT NULL`)
      expect(sql).toContain(`"status" = 'PENDING' AND "paidAt" IS NULL`)
    })

    it('debería declarar paidAt TIMESTAMP(3) nullable y default PENDING en SQL', () => {
      const sql = readFileSync(migrationPath, 'utf-8')
      expect(sql).toContain('"paidAt" TIMESTAMP(3)')
      expect(sql).not.toMatch(/"paidAt" TIMESTAMP\(3\) NOT NULL/)
      expect(sql).toContain(`DEFAULT 'PENDING'`)
    })
  })

  describe('Contrato de tarifa positiva', () => {
    it('debería tener Worker.dailyRate como Decimal(12,2) nullable', () => {
      const worker = blockOf(schema, 'model Worker')
      expect(worker).not.toBeNull()
      expect(worker).toMatch(/dailyRate\s+Decimal\?\s+@db\.Decimal\(12,\s*2\)/)
    })

    it('debería tener rateSnapshot como Decimal(12,2) obligatorio en DailyPayDay', () => {
      const day = blockOf(schema, 'model DailyPayDay')
      expect(day).not.toBeNull()
      expect(day).toMatch(/rateSnapshot\s+Decimal\s+@db\.Decimal\(12,\s*2\)/)
    })

    it('debería declarar el CHECK de tarifa positiva (NULL permitido, > 0 obligatorio)', () => {
      const sql = readFileSync(migrationPath, 'utf-8')
      expect(sql).toContain('CONSTRAINT "worker_daily_rate_positive"')
      expect(sql).toContain(`CHECK ("dailyRate" IS NULL OR "dailyRate" > 0)`)
    })
  })

  describe('Contrato multi-tenant (alcance obligatorio por organización)', () => {
    it('debería requerir organizationId con cascade e índice en los dos modelos', () => {
      for (const header of ['model DailyPayDay', 'model DailyPayMonthControl']) {
        const block = blockOf(schema, header)
        expect(block).not.toBeNull()
        expect(block).toMatch(/organizationId\s+String\s*$/m)
        expect(block).toMatch(
          /organization\s+Organization\s+@relation\(fields:\s*\[organizationId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/
        )
        expect(block).toContain('@@index([organizationId])')
      }
    })

    it('debería impedir días duplicados y controles duplicados por clave única', () => {
      const day = blockOf(schema, 'model DailyPayDay')
      expect(day).toContain('@@unique([workerId, workDate])')
      const control = blockOf(schema, 'model DailyPayMonthControl')
      expect(control).toContain('@@unique([organizationId, workerId, periodStart])')
    })

    it('debería crear índices de tenant solo para día y control en SQL', () => {
      const sql = readFileSync(migrationPath, 'utf-8')
      expect(sql).toContain('CREATE INDEX "DailyPayDay_organizationId_idx"')
      expect(sql).toContain('CREATE INDEX "DailyPayMonthControl_organizationId_idx"')
      expect(sql).not.toContain('DailyPayPayment_organizationId_idx')
    })
  })

  describe('Payroll intacto', () => {
    it('no debería introducir campos de pago diario en Payroll ni alterar su tabla', () => {
      const payroll = blockOf(schema, 'model Payroll')
      expect(payroll).not.toBeNull()
      expect(payroll).not.toMatch(/dailyRate|DailyPay/)
      const sql = readFileSync(migrationPath, 'utf-8')
      expect(sql).not.toContain('ALTER TABLE "Payroll"')
    })
  })

  describe('Contrato de migración remedida in situ', () => {
    const migrationExists = existsSync(migrationPath)
    const sql = migrationExists ? readFileSync(migrationPath, 'utf-8') : ''

    it('debería existir prisma/migrations/20260902180000_add_worker_daily_pay/migration.sql', () => {
      expect(migrationExists).toBe(true)
    })

    it('debería crear el enum PENDING/PAID, la columna de Worker y las dos tablas', () => {
      expect(sql).toContain(`CREATE TYPE "DailyPayMonthStatus" AS ENUM ('PENDING', 'PAID')`)
      expect(sql).toContain('ALTER TABLE "Worker" ADD COLUMN "dailyRate" DECIMAL(12,2)')
      expect(sql).toContain('CREATE TABLE "DailyPayDay"')
      expect(sql).toContain('CREATE TABLE "DailyPayMonthControl"')
      expect(sql).not.toContain('CREATE TABLE "DailyPayPayment"')
    })

    it('debería tener exactamente 2 columnas de dinero y fechas civiles DATE', () => {
      // Solo Worker.dailyRate y DailyPayDay.rateSnapshot: el marcador no lleva montos.
      expect((sql.match(/DECIMAL\(12,2\)/g) ?? []).length).toBe(2)
      expect((sql.match(/\bDATE\b/g) ?? []).length).toBeGreaterThanOrEqual(2)
    })

    it('debería renombrar las acciones de auditoría a marked-paid/marked-pending', () => {
      expect(sql).toContain(`ALTER TYPE "AuditAction" ADD VALUE 'DAILY_PAY_MONTH_MARKED_PAID'`)
      expect(sql).toContain(`ALTER TYPE "AuditAction" ADD VALUE 'DAILY_PAY_MONTH_MARKED_PENDING'`)
      expect(sql).not.toContain('DAILY_PAY_MONTH_CLOSE')
      expect(sql).not.toContain('DAILY_PAY_MONTH_REOPEN')
    })

    it('debería crear claves únicas y FKs en cascada solo para día y control', () => {
      expect(sql).toContain('CREATE UNIQUE INDEX "DailyPayDay_workerId_workDate_key"')
      expect(sql).toContain('CREATE UNIQUE INDEX "DailyPayMonthControl_organizationId_workerId_periodStart_key"')
      for (const table of ['DailyPayDay', 'DailyPayMonthControl']) {
        expect(sql).toContain(`CONSTRAINT "${table}_workerId_fkey"`)
        expect(sql).toContain(`CONSTRAINT "${table}_organizationId_fkey"`)
      }
      expect(sql).not.toContain('CONSTRAINT "DailyPayPayment_workerId_fkey"')
      expect(sql).not.toContain('CONSTRAINT "DailyPayPayment_organizationId_fkey"')
      expect((sql.match(/ON DELETE CASCADE/g) ?? []).length).toBeGreaterThanOrEqual(4)
    })

    it('no debería contener operaciones destructivas', () => {
      expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|DROP TYPE|DELETE FROM|TRUNCATE/i)
    })
  })

  describe('TM-PROC: contrato del harness de migración', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    it('debería incluir el gate de huella sobre DailyPayPayment con RAISE EXCEPTION', () => {
      expect(sql).toContain(`to_regclass('public."DailyPayPayment"'`)
      expect(sql).toContain('RAISE EXCEPTION')
    })

    it('debería ejecutar el gate antes de cualquier DDL (stop sin DDL)', () => {
      const gateIdx = sql.indexOf('RAISE EXCEPTION')
      expect(gateIdx).toBeGreaterThan(-1)
      expect(gateIdx).toBeLessThan(firstDdlIndex(sql))
    })

    it('debería mencionar DailyPayPayment únicamente dentro del gate', () => {
      const firstDdlIdx = firstDdlIndex(sql)
      let from = 0
      while (true) {
        const idx = sql.indexOf('DailyPayPayment', from)
        if (idx === -1) break
        expect(idx).toBeLessThan(firstDdlIdx)
        from = idx + 1
      }
    })

    it('no debería contener credenciales ni URIs de conexión en el artefacto', () => {
      expect(sql).not.toMatch(/postgres(?:ql)?:\/\//i)
      expect(sql).not.toMatch(/\bPASSWORD\b|\bSECRET\b|\bTOKEN\b/i)
      expect(sql).not.toMatch(/\bCONNINFO\b|\bCONNECT\b/i)
    })

    it('no debería leer variables de entorno ni .env desde el artefacto', () => {
      expect(sql).not.toMatch(/DATABASE_URL|DIRECT_URL/)
      expect(sql).not.toMatch(/\.env\b/)
    })
  })
})

// ---------------------------------------------------------------------------
// R3: comportamiento del repositorio daily-pay contra PostgreSQL desechable.
// Se ejecutan solo cuando TEST_DATABASE_URL apunta a una base con la migración
// 20260902180000 aplicada (harness DB-H); sin esa variable todo el bloque se
// omite y la suite sigue siendo el contrato de archivos de R1.
// ---------------------------------------------------------------------------

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const ddb = TEST_DATABASE_URL ? describe : describe.skip

ddb('R3: repositorio daily-pay contra PostgreSQL desechable', () => {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const PERIOD = '2026-03-01'
  const FROM = '2026-03-01'
  const TO = '2026-03-31'
  const STAMP = new Date('2026-03-15T10:30:00.000Z')
  const MONTH_LOCKED = 'MONTH_LOCKED'
  const EMPTY_MONTH = 'EMPTY_MONTH'

  let client: PrismaClient
  let repoA: DailyPayRepository
  let repoB: DailyPayRepository
  let orgAId = ''
  let orgBId = ''
  let workerAId = ''
  let workerBId = ''

  /** Flujo de marcaje del diseño: lock → conteo ≥ 1 → PAID (la política vive en el servicio). */
  const markPaidFlow = async (workerId: string, period: string, from: string, to: string) =>
    repoA.runSerializable(async (tx) => {
      await repoA.acquireMonthControl(workerId, period, tx)
      const { count } = await repoA.aggregateWorkedDays(workerId, from, to, tx)
      if (count < 1) throw new Error(EMPTY_MONTH)
      await repoA.setMonthState(workerId, period, 'PAID', new Date(), tx)
      return 'paid' as const
    })

  /** Flujo de edición de días del diseño: lock → conflicto si PAID → escritura. */
  const dayEditFlow = async (workerId: string, period: string, workDate: string) =>
    repoA.runSerializable(async (tx) => {
      const control = await repoA.acquireMonthControl(workerId, period, tx)
      if (control === null || control.status === 'PAID') throw new Error(MONTH_LOCKED)
      await repoA.createDay(workerId, workDate, '120.00', tx)
      return 'created' as const
    })

  beforeAll(async () => {
    client = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } })
    await client.$connect()
    const [orgA, orgB] = await Promise.all([
      client.organization.create({ data: { name: `r3-org-a-${stamp}` } }),
      client.organization.create({ data: { name: `r3-org-b-${stamp}` } }),
    ])
    orgAId = orgA.id
    orgBId = orgB.id
    const workerA = await client.worker.create({
      data: {
        name: 'worker-a',
        dni: `dni-a-${stamp}`,
        position: 'operario',
        baseSalary: 2000,
        dailyRate: new Prisma.Decimal('100.25'),
        startDate: new Date('2026-01-01'),
        organizationId: orgA.id,
      },
    })
    const workerB = await client.worker.create({
      data: {
        name: 'worker-b',
        dni: `dni-b-${stamp}`,
        position: 'operario',
        baseSalary: 2000,
        dailyRate: new Prisma.Decimal('90.00'),
        startDate: new Date('2026-01-01'),
        organizationId: orgB.id,
      },
    })
    workerAId = workerA.id
    workerBId = workerB.id
    await client.payroll.create({
      data: {
        workerId: workerA.id,
        month: 3,
        year: 2026,
        baseSalary: 2000,
        grossPay: 2000,
        netPay: 1600,
        organizationId: orgA.id,
      },
    })
    repoA = new DailyPayRepository(orgA.id, client)
    repoB = new DailyPayRepository(orgB.id, client)
  })

  afterAll(async () => {
    try {
      if (client && orgAId) {
        await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } })
      }
    } finally {
      await client?.$disconnect()
    }
  })

  it('debería devengar la suma exacta de los snapshots sin recalcular con la tarifa actual', async () => {
    const summary = await repoA.runSerializable(async (tx) => {
      await repoA.createDay(workerAId, '2026-03-03', '100.25', tx)
      await repoA.createDay(workerAId, '2026-03-05', '100.25', tx)
      await repoA.createDay(workerAId, '2026-03-10', '100.25', tx)
      const totals = await repoA.aggregateWorkedDays(workerAId, FROM, TO, tx)
      expect(totals).toEqual({ count: 3, accrued: '300.75' })
      expect(await repoA.countWorkedDays(workerAId, FROM, TO, tx)).toBe(3)
      return totals
    })
    expect(summary).toEqual({ count: 3, accrued: '300.75' })
    await repoA.setDailyRate(workerAId, '120.00')
    await repoA.runSerializable(async (tx) => {
      await repoA.createDay(workerAId, '2026-03-12', '120.00', tx)
      // Los snapshots previos siguen en 100.25; el nuevo día captura 120.00.
      expect(await repoA.aggregateWorkedDays(workerAId, FROM, TO, tx)).toEqual({ count: 4, accrued: '420.75' })
    })
  })

  it('debería iniciar el control en PENDING con paidAt nulo', async () => {
    await repoA.runSerializable(async (tx) => {
      const control = await repoA.acquireMonthControl(workerAId, PERIOD, tx)
      expect(control?.status).toBe('PENDING')
      expect(control?.paidAt).toBeNull()
      const found = await repoA.findMonth(workerAId, PERIOD, tx)
      expect(found?.id).toBe(control?.id)
    })
  })

  it('debería converger a un único control ante adquisiciones concurrentes', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        repoA.runSerializable((tx) => repoA.acquireMonthControl(workerAId, '2026-02-01', tx))
      )
    )
    for (const result of results) expect(result.status).toBe('fulfilled')
    const rows = await client.dailyPayMonthControl.findMany({
      where: { organizationId: orgAId, workerId: workerAId, periodStart: new Date('2026-02-01') },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('PENDING')
    expect(rows[0].paidAt).toBeNull()
  })

  it('debería rechazar los pares de estado inválidos sin cambiar el control', async () => {
    const scope = Prisma.sql`WHERE "organizationId" = ${orgAId} AND "workerId" = ${workerAId} AND "periodStart" = ${PERIOD}::date`
    await expect(
      client.$executeRaw(Prisma.sql`UPDATE "DailyPayMonthControl" SET status = 'PAID', "paidAt" = NULL ${scope}`)
    ).rejects.toThrow()
    await expect(
      client.$executeRaw(Prisma.sql`UPDATE "DailyPayMonthControl" SET status = 'PENDING', "paidAt" = NOW() ${scope}`)
    ).rejects.toThrow()
    await repoA.runSerializable(async (tx) => {
      const control = await repoA.findMonth(workerAId, PERIOD, tx)
      expect(control?.status).toBe('PENDING')
      expect(control?.paidAt).toBeNull()
    })
  })

  it('debería estampar y limpiar paidAt de forma idempotente en el ciclo completo del marcador', async () => {
    await repoA.runSerializable(async (tx) => {
      await repoA.acquireMonthControl(workerAId, PERIOD, tx)
      const paid = await repoA.setMonthState(workerAId, PERIOD, 'PAID', STAMP, tx)
      expect(paid.status).toBe('PAID')
      expect(paid.paidAt?.toISOString()).toBe(STAMP.toISOString())
      const repeated = await repoA.setMonthState(workerAId, PERIOD, 'PAID', STAMP, tx)
      expect(repeated.status).toBe('PAID')
      expect(repeated.paidAt?.toISOString()).toBe(STAMP.toISOString())
      const reverted = await repoA.setMonthState(workerAId, PERIOD, 'PENDING', null, tx)
      expect(reverted.status).toBe('PENDING')
      expect(reverted.paidAt).toBeNull()
    })
  })

  it('debería mantener los contextos aislados por organización sin bypass de roles', async () => {
    await repoB.runSerializable(async (tx) => {
      const control = await repoB.acquireMonthControl(workerBId, PERIOD, tx)
      expect(control?.status).toBe('PENDING')
    })
    await repoA.runSerializable(async (tx) => {
      expect(await repoA.findMonth(workerBId, PERIOD, tx)).toBeNull()
      expect(await repoA.createDay(workerBId, '2026-03-20', '100.25', tx)).toBeNull()
      expect(await repoA.aggregateWorkedDays(workerBId, FROM, TO, tx)).toEqual({ count: 0, accrued: '0.00' })
    })
    await expect(
      repoA.runSerializable((tx) => repoA.setMonthState(workerBId, PERIOD, 'PAID', STAMP, tx))
    ).rejects.toThrow()
    await repoB.runSerializable(async (tx) => {
      const control = await repoB.findMonth(workerBId, PERIOD, tx)
      expect(control?.status).toBe('PENDING')
      expect(control?.paidAt).toBeNull()
    })
  })

  it('debería negar la adquisición del control de un worker ajeno sin crear filas para la organización atacante', async () => {
    await repoA.runSerializable(async (tx) => {
      expect(await repoA.acquireMonthControl(workerBId, PERIOD, tx)).toBeNull()
    })
    // La organización atacante no obtiene ninguna fila de control para el worker ajeno.
    expect(
      await client.dailyPayMonthControl.count({ where: { organizationId: orgAId, workerId: workerBId } })
    ).toBe(0)
  })

  it('no debería confirmar ninguna edición de día después de la transición a PAID', async () => {
    const period = '2026-01-01'
    const monthRange = { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') }
    const daysInJanuary = () =>
      client.dailyPayDay.count({ where: { organizationId: orgAId, workerId: workerAId, workDate: monthRange } })
    await expect(dayEditFlow(workerAId, period, '2026-01-05')).resolves.toBe('created')
    const [mark, edit] = await Promise.allSettled([
      markPaidFlow(workerAId, period, '2026-01-01', '2026-01-31'),
      dayEditFlow(workerAId, period, '2026-01-06'),
    ])
    expect(mark.status).toBe('fulfilled')
    const daysAfterRace = await daysInJanuary()
    if (edit.status === 'fulfilled') {
      expect(edit.value).toBe('created')
      expect(daysAfterRace).toBe(2)
    } else {
      expect((edit.reason as Error).message).toMatch(/MONTH_LOCKED|40001|P2034/)
      expect(daysAfterRace).toBe(1)
    }
    const control = await client.dailyPayMonthControl.findFirst({
      where: { organizationId: orgAId, workerId: workerAId, periodStart: new Date('2026-01-01') },
    })
    expect(control?.status).toBe('PAID')
    expect(control?.paidAt).not.toBeNull()
    // Después del PAID, ninguna edición de día puede confirmarse por la vía compuesta.
    await expect(dayEditFlow(workerAId, period, '2026-01-07')).rejects.toThrow(MONTH_LOCKED)
    expect(await daysInJanuary()).toBe(daysAfterRace)
  })

  it('debería dejar la Nómina intacta ante las operaciones de pago diario', async () => {
    const payrolls = await client.payroll.findMany({ where: { workerId: workerAId } })
    expect(payrolls).toHaveLength(1)
    expect(payrolls[0].paidAt).toBeNull()
    expect(payrolls[0].grossPay).toBe(2000)
    expect(payrolls[0].netPay).toBe(1600)
    expect(await client.payroll.count({ where: { workerId: workerBId } })).toBe(0)
  })

  it('debería limpiar por completo los datos desechables de la prueba', async () => {
    const deleted = await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } })
    expect(deleted.count).toBe(2)
    const delegates: OrgScopedCountDelegate[] = [
      client.dailyPayDay,
      client.dailyPayMonthControl,
      client.worker,
      client.payroll,
    ]
    for (const delegate of delegates) {
      expect(await delegate.count({ where: { organizationId: { in: [orgAId, orgBId] } } })).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// F4: servicio daily-pay contra PostgreSQL desechable: transición atómica
// estado+auditoría en una sola transacción Serializable, reintentos acotados,
// carreras de marcaje/reversa, tenencia sin bypass e independencia de Nómina.
// Se ejecutan solo cuando TEST_DATABASE_URL apunta a la base del harness DB-H
// (migración 20260902180000 aplicada); sin esa variable el bloque se omite.
// ---------------------------------------------------------------------------

ddb('F4: servicio daily-pay contra PostgreSQL desechable', () => {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const PERIOD = '2026-05-01'
  const MARKED_PAID = 'DAILY_PAY_MONTH_MARKED_PAID'
  const MARKED_PENDING = 'DAILY_PAY_MONTH_MARKED_PENDING'
  const MONTH_LOCKED = 'MONTH_LOCKED'

  let client: PrismaClient
  let repoA: DailyPayRepository
  let repoB: DailyPayRepository
  let serviceA: DailyPayService
  let serviceB: DailyPayService
  let orgAId = ''
  let orgBId = ''
  let workerAId = ''
  let workerBId = ''
  let userAId = ''
  let userBId = ''

  const controlOf = (workerId: string, period: string) =>
    client.dailyPayMonthControl.findFirst({
      where: { organizationId: orgAId, workerId, periodStart: new Date(period) },
    })

  const auditRows = (action: string) =>
    client.auditLog.findMany({ where: { organizationId: orgAId, action: action as AuditAction } })

  /** Filas de auditoría de una acción para un período concreto (details.periodStart). */
  const monthAudits = async (action: string, period: string) =>
    (await auditRows(action)).filter(
      (row) => (row.details as { periodStart?: string }).periodStart === period
    )

  /** Flujo de edición de días del diseño: lock → conflicto si PAID → escritura. */
  const dayEditFlow = async (workerId: string, period: string, workDate: string) =>
    repoA.runSerializable(async (tx) => {
      const control = await repoA.acquireMonthControl(workerId, period, tx)
      if (control === null || control.status === 'PAID') throw new Error(MONTH_LOCKED)
      await repoA.createDay(workerId, workDate, '100.25', tx)
      return 'created' as const
    })

  beforeAll(async () => {
    client = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } })
    await client.$connect()
    const [orgA, orgB] = await Promise.all([
      client.organization.create({ data: { name: `f4-org-a-${stamp}` } }),
      client.organization.create({ data: { name: `f4-org-b-${stamp}` } }),
    ])
    orgAId = orgA.id
    orgBId = orgB.id
    const workerA = await client.worker.create({
      data: {
        name: 'worker-a',
        dni: `dni-a-${stamp}`,
        position: 'operario',
        baseSalary: 2000,
        dailyRate: new Prisma.Decimal('100.25'),
        startDate: new Date('2026-01-01'),
        organizationId: orgAId,
      },
    })
    const workerB = await client.worker.create({
      data: {
        name: 'worker-b',
        dni: `dni-b-${stamp}`,
        position: 'operario',
        baseSalary: 2000,
        startDate: new Date('2026-01-01'),
        organizationId: orgBId,
      },
    })
    workerAId = workerA.id
    workerBId = workerB.id
    const [userA, userB] = await Promise.all([
      client.user.create({
        data: { name: 'actor-a', email: `actor-a-${stamp}@test.local`, organizationId: orgAId },
      }),
      client.user.create({
        data: { name: 'actor-b', email: `actor-b-${stamp}@test.local`, organizationId: orgBId },
      }),
    ])
    userAId = userA.id
    userBId = userB.id
    await client.payroll.create({
      data: {
        workerId: workerAId,
        month: 5,
        year: 2026,
        baseSalary: 2000,
        grossPay: 2000,
        netPay: 1600,
        organizationId: orgAId,
      },
    })
    repoA = new DailyPayRepository(orgAId, client)
    repoB = new DailyPayRepository(orgBId, client)
    serviceA = new DailyPayService(orgAId, { repository: repoA })
    serviceB = new DailyPayService(orgBId, { repository: repoB })
  })

  afterAll(async () => {
    try {
      if (client && orgAId) {
        await client.auditLog.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } })
        await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } })
      }
    } finally {
      await client?.$disconnect()
    }
  })

  it('debería marcar PAID atómicamente estampando paidAt y un único evento de auditoría', async () => {
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-05-04', '100.25', tx))
    const result = await serviceA.markPaid(workerAId, PERIOD, { userId: userAId })

    expect(result.status).toBe('PAID')
    expect(result.transitioned).toBe(true)
    const control = await controlOf(workerAId, PERIOD)
    expect(control?.status).toBe('PAID')
    expect(control?.paidAt).not.toBeNull()

    const rows = await monthAudits(MARKED_PAID, PERIOD)
    expect(rows).toHaveLength(1)
    expect(rows[0].userId).toBe(userAId)
    expect(rows[0].organizationId).toBe(orgAId)
    expect(rows[0].createdAt).toBeDefined()
    const details = rows[0].details as Record<string, unknown>
    expect(details).toMatchObject({
      workerId: workerAId,
      periodStart: PERIOD,
      transition: 'PENDING→PAID',
      previousPaidAt: null,
    })
    expect(details.newPaidAt).toBe(control!.paidAt!.toISOString())
    expect('reason' in details).toBe(false)
  })

  it('debería revertir con auditoría, limpiar paidAt y desbloquear la edición de días', async () => {
    const before = await controlOf(workerAId, PERIOD)
    const previousPaidAt = before!.paidAt!.toISOString()
    const pendingBefore = await auditRows(MARKED_PENDING).then((rows) => rows.length)

    const result = await serviceA.revert(
      workerAId,
      PERIOD,
      { userId: userAId },
      { reason: 'corrección de asistencia' }
    )
    expect(result).toEqual({ status: 'PENDING', paidAt: null, transitioned: true })
    const control = await controlOf(workerAId, PERIOD)
    expect(control?.status).toBe('PENDING')
    expect(control?.paidAt).toBeNull()

    const rows = await monthAudits(MARKED_PENDING, PERIOD)
    expect(rows).toHaveLength(1)
    expect(await auditRows(MARKED_PENDING)).toHaveLength(pendingBefore + 1)
    const details = rows[0].details as Record<string, unknown>
    expect(details).toMatchObject({
      workerId: workerAId,
      periodStart: PERIOD,
      transition: 'PAID→PENDING',
      previousPaidAt,
      reason: 'corrección de asistencia',
    })

    // Desbloqueo: la edición de días vuelve a confirmarse tras la reversa.
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-05-05', '100.25', tx))
    const days = await client.dailyPayDay.count({
      where: {
        organizationId: orgAId,
        workerId: workerAId,
        workDate: { gte: new Date(PERIOD), lte: new Date('2026-05-31') },
      },
    })
    expect(days).toBe(2)
  })

  it('no debería dejar estado ni auditoría cuando el marcaje no puede auditar (FK de actor)', async () => {
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-06-01', '100.25', tx))
    const paidBefore = await auditRows(MARKED_PAID).then((rows) => rows.length)

    await expect(
      serviceA.markPaid(workerAId, '2026-06-01', { userId: 'user-fantasma' })
    ).rejects.toThrow()

    expect(await auditRows(MARKED_PAID)).toHaveLength(paidBefore)
    expect(await controlOf(workerAId, '2026-06-01')).toBeNull()
  })

  it('no debería dejar estado ni auditoría cuando la reversa no puede auditar (FK de actor)', async () => {
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-12-01', '100.25', tx))
    await serviceA.markPaid(workerAId, '2026-12-01', { userId: userAId })
    const pendingBefore = await auditRows(MARKED_PENDING).then((rows) => rows.length)

    await expect(
      serviceA.revert(workerAId, '2026-12-01', { userId: 'user-fantasma' }, { reason: 'cierre erróneo' })
    ).rejects.toThrow()

    expect(await auditRows(MARKED_PENDING)).toHaveLength(pendingBefore)
    const control = await controlOf(workerAId, '2026-12-01')
    expect(control?.status).toBe('PAID')
    expect(control?.paidAt).not.toBeNull()
  })

  it('debería converger a un único evento de auditoría ante marcas concurrentes', async () => {
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-07-02', '100.25', tx))
    const results = await Promise.allSettled([
      serviceA.markPaid(workerAId, '2026-07-01', { userId: userAId }),
      serviceA.markPaid(workerAId, '2026-07-01', { userId: userAId }),
    ])
    for (const result of results) expect(result.status).toBe('fulfilled')

    const control = await controlOf(workerAId, '2026-07-01')
    expect(control?.status).toBe('PAID')
    expect(await monthAudits(MARKED_PAID, '2026-07-01')).toHaveLength(1)
    expect(await monthAudits(MARKED_PENDING, '2026-07-01')).toHaveLength(0)
  })

  it('debería ser determinista en la carrera mark-vs-revert sin auditoría parcial', async () => {
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-08-03', '100.25', tx))
    await Promise.allSettled([
      serviceA.markPaid(workerAId, '2026-08-01', { userId: userAId }),
      serviceA.revert(workerAId, '2026-08-01', { userId: userAId }),
    ])

    const control = await controlOf(workerAId, '2026-08-01')
    const paidRows = await monthAudits(MARKED_PAID, '2026-08-01')
    const pendingRows = await monthAudits(MARKED_PENDING, '2026-08-01')
    expect(paidRows.length).toBeLessThanOrEqual(1)
    expect(pendingRows.length).toBeLessThanOrEqual(1)
    // Nunca existe reversa auditada sin su marcaje previo.
    if (pendingRows.length === 1) expect(paidRows).toHaveLength(1)
    if (control?.status === 'PAID') {
      expect(paidRows).toHaveLength(1)
      expect(pendingRows).toHaveLength(0)
    } else {
      expect(control?.status).toBe('PENDING')
      expect(control?.paidAt).toBeNull()
    }
  })

  it('debería denegar el mes vacío sin crear control ni auditoría', async () => {
    const paidBefore = await auditRows(MARKED_PAID).then((rows) => rows.length)
    await expect(
      serviceA.markPaid(workerAId, '2026-09-01', { userId: userAId })
    ).rejects.toThrow(DailyPayEmptyMonthError)

    expect(await controlOf(workerAId, '2026-09-01')).toBeNull()
    expect(await auditRows(MARKED_PAID)).toHaveLength(paidBefore)
  })

  it('debería bloquear la edición de días de un mes PAID por el servicio', async () => {
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-11-02', '100.25', tx))
    await serviceA.markPaid(workerAId, '2026-11-01', { userId: userAId })

    await expect(dayEditFlow(workerAId, '2026-11-01', '2026-11-03')).rejects.toThrow(MONTH_LOCKED)
    const days = await client.dailyPayDay.count({
      where: {
        organizationId: orgAId,
        workerId: workerAId,
        workDate: { gte: new Date('2026-11-01'), lte: new Date('2026-11-30') },
      },
    })
    expect(days).toBe(1)
  })

  it('no-op: marcar de nuevo preserva el timestamp exacto y no duplica auditoría', async () => {
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-10-02', '100.25', tx))
    await serviceA.markPaid(workerAId, '2026-10-01', { userId: userAId })
    const firstPaidAt = (await controlOf(workerAId, '2026-10-01'))!.paidAt!.toISOString()
    expect(await monthAudits(MARKED_PAID, '2026-10-01')).toHaveLength(1)

    const result = await serviceA.markPaid(workerAId, '2026-10-01', { userId: userAId })
    expect(result).toEqual({ status: 'PAID', paidAt: firstPaidAt, transitioned: false })

    const control = await controlOf(workerAId, '2026-10-01')
    expect(control!.paidAt!.toISOString()).toBe(firstPaidAt)
    expect(await monthAudits(MARKED_PAID, '2026-10-01')).toHaveLength(1)
  })

  it('no-op: repetir mark-paid preserva updatedAt junto a paidAt sin nuevo evento de auditoría', async () => {
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-02-03', '100.25', tx))
    await serviceA.markPaid(workerAId, '2026-02-01', { userId: userAId })
    const first = await controlOf(workerAId, '2026-02-01')
    const paidAtBefore = first!.paidAt!.toISOString()
    const updatedAtBefore = first!.updatedAt.getTime()

    // La pausa garantiza que un toque del lock defectuoso produciría un
    // updatedAt estrictamente mayor; el no-op correcto no escribe nada.
    await new Promise((resolve) => setTimeout(resolve, 15))
    const result = await serviceA.markPaid(workerAId, '2026-02-01', { userId: userAId })
    expect(result).toEqual({ status: 'PAID', paidAt: paidAtBefore, transitioned: false })

    const after = await controlOf(workerAId, '2026-02-01')
    expect(after!.updatedAt.getTime()).toBe(updatedAtBefore)
    expect(after!.paidAt!.toISOString()).toBe(paidAtBefore)
    expect(await monthAudits(MARKED_PAID, '2026-02-01')).toHaveLength(1)
  })

  it('no-op: repetir la reversa sobre PENDING preserva updatedAt sin nuevo evento de auditoría', async () => {
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-03-03', '100.25', tx))
    await serviceA.markPaid(workerAId, '2026-03-01', { userId: userAId })
    await serviceA.revert(workerAId, '2026-03-01', { userId: userAId })
    const pending = await controlOf(workerAId, '2026-03-01')
    const updatedAtBefore = pending!.updatedAt.getTime()
    expect(await monthAudits(MARKED_PENDING, '2026-03-01')).toHaveLength(1)

    await new Promise((resolve) => setTimeout(resolve, 15))
    const result = await serviceA.revert(workerAId, '2026-03-01', { userId: userAId })
    expect(result).toEqual({ status: 'PENDING', paidAt: null, transitioned: false })

    const after = await controlOf(workerAId, '2026-03-01')
    expect(after!.updatedAt.getTime()).toBe(updatedAtBefore)
    expect(after!.paidAt).toBeNull()
    expect(await monthAudits(MARKED_PENDING, '2026-03-01')).toHaveLength(1)
  })

  it('debería dejar la Nómina intacta tras las transiciones de pago diario', async () => {
    const payrolls = await client.payroll.findMany({ where: { workerId: workerAId } })
    expect(payrolls).toHaveLength(1)
    expect(payrolls[0].paidAt).toBeNull()
    expect(payrolls[0].grossPay).toBe(2000)
    expect(payrolls[0].netPay).toBe(1600)
    expect(await client.payroll.count({ where: { workerId: workerBId } })).toBe(0)
  })

  it('debería negar al actor externo sin estado ni auditoría (sin bypass PLATFORM_ADMIN)', async () => {
    // Mes propio en PAID: el intento externo no debe cambiarlo.
    await repoA.runSerializable((tx) => repoA.createDay(workerAId, '2026-04-02', '100.25', tx))
    await serviceA.markPaid(workerAId, '2026-04-01', { userId: userAId })
    const paidBefore = await auditRows(MARKED_PAID).then((rows) => rows.length)

    await expect(serviceB.markPaid(workerAId, '2026-04-01', { userId: userBId })).rejects.toThrow(
      DailyPayMonthNotFoundError
    )
    await expect(serviceB.revert(workerAId, '2026-04-01', { userId: userBId })).rejects.toThrow(
      DailyPayMonthNotFoundError
    )

    expect(
      await client.dailyPayMonthControl.count({ where: { organizationId: orgBId, workerId: workerAId } })
    ).toBe(0)
    expect(await client.auditLog.count({ where: { organizationId: orgBId } })).toBe(0)
    expect(await auditRows(MARKED_PAID)).toHaveLength(paidBefore)
    const control = await controlOf(workerAId, '2026-04-01')
    expect(control?.status).toBe('PAID')
    expect(control?.paidAt).not.toBeNull()
  })

  it('debería limpiar por completo los datos desechables de la prueba', async () => {
    await client.auditLog.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } })
    const deleted = await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } })
    expect(deleted.count).toBe(2)
    const delegates: OrgScopedCountDelegate[] = [
      client.dailyPayDay,
      client.dailyPayMonthControl,
      client.worker,
      client.payroll,
      client.user,
      client.auditLog,
    ]
    for (const delegate of delegates) {
      expect(await delegate.count({ where: { organizationId: { in: [orgAId, orgBId] } } })).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// F7: historial anual e integración final contra PostgreSQL desechable. Compone
// el historial exactamente como la ruta /history — por cada mes del año, el
// control y la suma exacta de snapshots en una sola snapshot Serializable, y
// annualHistoryMonths sintetiza los meses ausentes (PENDING/null/0.00) sin
// escrituras. Cubre el contrato del task 4.1: historial anual, marcador/
// devengo, tenencia, concurrencia y Nómina.
// ---------------------------------------------------------------------------

ddb('F7: historial anual e integración contra PostgreSQL desechable', () => {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const YEAR = 2026
  const MARKED_PAID = 'DAILY_PAY_MONTH_MARKED_PAID' as const

  let client: PrismaClient
  let repoA: DailyPayRepository
  let repoB: DailyPayRepository
  let serviceA: DailyPayService
  let serviceB: DailyPayService
  let orgAId = ''
  let orgBId = ''
  let workerAId = ''
  let userAId = ''

  /** Igual que la ruta /history: meses con control + su devengo, en una snapshot. */
  const historyMonths = (
    repository: DailyPayRepository,
    workerId: string,
    year: number
  ): Promise<DailyPayHistoryMonthDTO[]> =>
    repository.runSerializable(async (tx) => {
      const entries: DailyPayHistoryMonthDTO[] = []
      for (let index = 1; index <= 12; index += 1) {
        const periodStart = `${year}-${String(index).padStart(2, '0')}-01`
        const [control, aggregate] = await Promise.all([
          repository.findMonth(workerId, periodStart, tx),
          repository.aggregateWorkedDays(workerId, periodStart, monthEnd(periodStart), tx),
        ])
        if (control) {
          entries.push({
            periodStart,
            status: control.status,
            paidAt: control.paidAt?.toISOString() ?? null,
            accrued: aggregate.accrued,
          })
        }
      }
      return entries
    })

  const buildYear = async (repository: DailyPayRepository, workerId: string, year: number) => {
    const present = await historyMonths(repository, workerId, year)
    return { year, months: annualHistoryMonths(year, present) }
  }

  beforeAll(async () => {
    client = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } })
    await client.$connect()
    const [orgA, orgB] = await Promise.all([
      client.organization.create({ data: { name: `f7-org-a-${stamp}` } }),
      client.organization.create({ data: { name: `f7-org-b-${stamp}` } }),
    ])
    orgAId = orgA.id
    orgBId = orgB.id
    const workerA = await client.worker.create({
      data: {
        name: 'worker-a',
        dni: `dni-a-${stamp}`,
        position: 'operario',
        baseSalary: 2000,
        dailyRate: new Prisma.Decimal('100.25'),
        startDate: new Date('2026-01-01'),
        organizationId: orgAId,
      },
    })
    workerAId = workerA.id
    const userA = await client.user.create({
      data: { name: 'actor-a', email: `actor-a-${stamp}@test.local`, organizationId: orgAId },
    })
    userAId = userA.id
    await client.payroll.create({
      data: {
        workerId: workerAId,
        month: 6,
        year: 2026,
        baseSalary: 2000,
        grossPay: 2000,
        netPay: 1600,
        organizationId: orgAId,
      },
    })
    repoA = new DailyPayRepository(orgAId, client)
    repoB = new DailyPayRepository(orgBId, client)
    serviceA = new DailyPayService(orgAId, { repository: repoA })
    serviceB = new DailyPayService(orgBId, { repository: repoB })
  })

  afterAll(async () => {
    try {
      if (client && orgAId) {
        await client.auditLog.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } })
        await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } })
      }
    } finally {
      await client?.$disconnect()
    }
  })

  it('debería componer doce meses ordenados con status/paidAt/devengo exacto y solo esos campos', async () => {
    // Enero: 2 días (200.50) marcado PAID; Febrero: 1 día (100.25) PENDING;
    // Marzo: 3 días (300.75) PENDING; el resto del año no tiene filas.
    await repoA.runSerializable(async (tx) => {
      await repoA.acquireMonthControl(workerAId, '2026-01-01', tx)
      await repoA.createDay(workerAId, '2026-01-05', '100.25', tx)
      await repoA.createDay(workerAId, '2026-01-12', '100.25', tx)
      await repoA.acquireMonthControl(workerAId, '2026-02-01', tx)
      await repoA.createDay(workerAId, '2026-02-03', '100.25', tx)
      await repoA.acquireMonthControl(workerAId, '2026-03-01', tx)
      await repoA.createDay(workerAId, '2026-03-04', '100.25', tx)
      await repoA.createDay(workerAId, '2026-03-10', '100.25', tx)
      await repoA.createDay(workerAId, '2026-03-18', '100.25', tx)
    })
    await serviceA.markPaid(workerAId, '2026-01-01', { userId: userAId })

    const year = await buildYear(repoA, workerAId, YEAR)
    expect(year.year).toBe(YEAR)
    expect(year.months).toHaveLength(12)
    expect(year.months[0]).toMatchObject({
      periodStart: '2026-01-01',
      status: 'PAID',
      accrued: '200.50',
    })
    expect(new Date(year.months[0].paidAt as string).toISOString()).toBe(year.months[0].paidAt)
    expect(year.months[1]).toEqual({
      periodStart: '2026-02-01',
      status: 'PENDING',
      paidAt: null,
      accrued: '100.25',
    })
    expect(year.months[2]).toEqual({
      periodStart: '2026-03-01',
      status: 'PENDING',
      paidAt: null,
      accrued: '300.75',
    })
    // Meses ausentes sintetizados en orden, sin escrituras.
    for (let index = 3; index < 12; index += 1) {
      expect(year.months[index]).toEqual({
        periodStart: `2026-${String(index + 1).padStart(2, '0')}-01`,
        status: 'PENDING',
        paidAt: null,
        accrued: '0.00',
      })
    }
    for (const month of year.months) {
      expect(Object.keys(month).sort()).toEqual(['accrued', 'paidAt', 'periodStart', 'status'])
    }
    expect(
      await client.dailyPayMonthControl.count({
        where: {
          organizationId: orgAId,
          workerId: workerAId,
          periodStart: { gte: new Date('2026-04-01'), lte: new Date('2026-12-01') },
        },
      })
    ).toBe(0)
  })

  it('debería mantener el devengo de snapshots y el marcador estables ante un cambio de tarifa', async () => {
    const janBefore = await client.dailyPayMonthControl.findFirst({
      where: { organizationId: orgAId, workerId: workerAId, periodStart: new Date('2026-01-01') },
    })
    expect(janBefore?.status).toBe('PAID')

    await repoA.setDailyRate(workerAId, '120.00')
    await repoA.runSerializable(async (tx) => {
      await repoA.acquireMonthControl(workerAId, '2026-04-01', tx)
      await repoA.createDay(workerAId, '2026-04-02', '120.00', tx)
    })
    await serviceA.markPaid(workerAId, '2026-04-01', { userId: userAId })

    const year = await buildYear(repoA, workerAId, YEAR)
    // Los snapshots previos no se recalculan con la tarifa nueva.
    expect(year.months[0].accrued).toBe('200.50')
    expect(year.months[3]).toMatchObject({
      periodStart: '2026-04-01',
      status: 'PAID',
      accrued: '120.00',
    })
    const janAfter = await client.dailyPayMonthControl.findFirst({
      where: { organizationId: orgAId, workerId: workerAId, periodStart: new Date('2026-01-01') },
    })
    expect(janAfter?.paidAt?.toISOString()).toBe(janBefore?.paidAt?.toISOString())
  })

  it('debería excluir al worker ajeno del historial de otra organización (sin bypass)', async () => {
    const foreign = await buildYear(repoB, workerAId, YEAR)
    for (const month of foreign.months) {
      expect(month).toEqual({
        periodStart: month.periodStart,
        status: 'PENDING',
        paidAt: null,
        accrued: '0.00',
      })
    }
    expect(
      await client.dailyPayMonthControl.count({
        where: { organizationId: orgBId, workerId: workerAId },
      })
    ).toBe(0)
    await expect(serviceB.markPaid(workerAId, '2026-01-01', { userId: userAId })).rejects.toThrow(
      DailyPayMonthNotFoundError
    )
    const jan = await client.dailyPayMonthControl.findFirst({
      where: { organizationId: orgAId, workerId: workerAId, periodStart: new Date('2026-01-01') },
    })
    expect(jan?.status).toBe('PAID')
  })

  it('debería converger las marcas concurrentes a un único evento y dejar la Nómina intacta', async () => {
    await repoA.runSerializable(async (tx) => {
      await repoA.acquireMonthControl(workerAId, '2026-05-01', tx)
      await repoA.createDay(workerAId, '2026-05-02', '100.25', tx)
    })
    const results = await Promise.allSettled([
      serviceA.markPaid(workerAId, '2026-05-01', { userId: userAId }),
      serviceA.markPaid(workerAId, '2026-05-01', { userId: userAId }),
    ])
    for (const result of results) expect(result.status).toBe('fulfilled')

    const may = await client.dailyPayMonthControl.findFirst({
      where: { organizationId: orgAId, workerId: workerAId, periodStart: new Date('2026-05-01') },
    })
    expect(may?.status).toBe('PAID')
    expect(may?.paidAt).not.toBeNull()
    expect(
      await client.auditLog.count({
        where: { organizationId: orgAId, action: MARKED_PAID },
      })
    ).toBeGreaterThanOrEqual(1)
    const mayAudits = await client.auditLog.findMany({
      where: { organizationId: orgAId, action: MARKED_PAID },
    })
    expect(mayAudits.filter((row) => (row.details as { periodStart?: string }).periodStart === '2026-05-01')).toHaveLength(1)

    const year = await buildYear(repoA, workerAId, YEAR)
    expect(year.months[4]).toMatchObject({ periodStart: '2026-05-01', status: 'PAID', accrued: '100.25' })

    // Nómina independiente tras todo el flujo del año.
    const payrolls = await client.payroll.findMany({ where: { workerId: workerAId } })
    expect(payrolls).toHaveLength(1)
    expect(payrolls[0].paidAt).toBeNull()
    expect(payrolls[0].grossPay).toBe(2000)
    expect(payrolls[0].netPay).toBe(1600)
  })

  it('debería limpiar por completo los datos desechables del año', async () => {
    await client.auditLog.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } })
    const deleted = await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } })
    expect(deleted.count).toBe(2)
    const delegates: OrgScopedCountDelegate[] = [
      client.dailyPayDay,
      client.dailyPayMonthControl,
      client.worker,
      client.payroll,
      client.user,
      client.auditLog,
    ]
    for (const delegate of delegates) {
      expect(await delegate.count({ where: { organizationId: { in: [orgAId, orgBId] } } })).toBe(0)
    }
  })
})
