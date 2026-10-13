import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { resolvePayrollPeriod, withPayrollWorkerLock, assertNoPaidOverlap, payrollErrorResponse } from '@/lib/payroll-period'

const DEFAULT_SS_PERCENT = 0

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workerId,
      baseSalary,
      irpfPercent = 0,
      socialSecurityPercent = DEFAULT_SS_PERCENT,
      bonusAmount = 0,
      bonusDesc = '',
      otherDeductions = 0,
      otherDeductionsDesc = '',
      notes = '',
    } = body

    const period = resolvePayrollPeriod(body)

    if (!workerId || typeof baseSalary !== 'number' || !Number.isFinite(baseSalary) || baseSalary <= 0) {
      return Response.json(
        { error: 'Trabajador, mes, año y salario base son requeridos' },
        { status: 400 }
      )
    }

    if (
      typeof irpfPercent !== 'number' ||
      irpfPercent < 0 ||
      irpfPercent > 100 ||
      typeof socialSecurityPercent !== 'number' ||
      socialSecurityPercent < 0 ||
      socialSecurityPercent > 100
    ) {
      return Response.json({ error: 'Los porcentajes deben estar entre 0 y 100' }, { status: 400 })
    }

    // Verify worker belongs to this org
    const worker = await prisma.worker.findFirst({
      where: { id: workerId, organizationId: user.organizationId },
    })
    if (!worker) {
      return Response.json({ error: 'Trabajador no encontrado' }, { status: 404 })
    }

    // Pending documents never reserve days; only paid periods do.

    const irpfAmount = Math.round(baseSalary * (irpfPercent / 100) * 100) / 100
    const ssAmount = Math.round(baseSalary * (socialSecurityPercent / 100) * 100) / 100
    const grossPay = Math.round((baseSalary + bonusAmount) * 100) / 100
    const netPay = Math.round((grossPay - irpfAmount - ssAmount - otherDeductions) * 100) / 100

    const payroll = await withPayrollWorkerLock(prisma, user.organizationId, workerId, async (tx) => {
      await assertNoPaidOverlap(tx, user.organizationId!, workerId, period)
      return tx.payroll.create({
      data: {
        workerId,
        ...period,
        baseSalary,
        irpfPercent,
        irpfAmount,
        socialSecurityPercent,
        socialSecurityAmount: ssAmount,
        bonuses: bonusAmount,
        bonusesDesc: bonusDesc || undefined,
        otherDeductions,
        otherDeductionsDesc: otherDeductionsDesc || undefined,
        grossPay,
        netPay,
        notes: notes || undefined,
        organizationId: user.organizationId!,
      },
      include: { worker: true },
      })
    })

    revalidatePath('/nomina')
    return Response.json(payroll)
  } catch (error) {
    return payrollErrorResponse(error, 'Error al generar la nómina')
  }
}
