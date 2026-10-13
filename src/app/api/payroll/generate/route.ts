import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { resolvePayrollPeriod, withPayrollWorkerLock, assertNoPaidOverlap, PayrollPeriodError, payrollErrorResponse } from '@/lib/payroll-period'

const SS_PERCENT = 6.35

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      month, 
      year, 
      irpfPercent,
      bonusPercent = 0,
      otherDeductionsPercent = 0,
      bonusDesc = '',
      otherDeductionsDesc = ''
    } = body

    if (!month || !year) {
      return Response.json(
        { error: 'Mes y año son requeridos' },
        { status: 400 }
      )
    }

    const period = resolvePayrollPeriod({ month, year })
    const irpf = irpfPercent ?? 15
    const activeWorkers = await prisma.worker.findMany({
      where: { status: 'ACTIVE', organizationId: user.organizationId },
      orderBy: { name: 'asc' },
    })

    const created = []
    const skipped = []

    for (const worker of activeWorkers) {
      // Pending documents never block monthly regeneration.

      // Calculate amounts
      const bonusAmount = Math.round(worker.baseSalary * (bonusPercent / 100) * 100) / 100
      const otherDedAmount = Math.round(worker.baseSalary * (otherDeductionsPercent / 100) * 100) / 100
      
      // Gross = base + bonuses
      const grossPay = Math.round((worker.baseSalary + bonusAmount) * 100) / 100
      
      // IRPF and SS are calculated on gross pay (base + bonuses)
      const irpfAmount = Math.round(grossPay * (irpf / 100) * 100) / 100
      const ssAmount = Math.round(grossPay * (SS_PERCENT / 100) * 100) / 100
      
      // Net = gross - all deductions
      const netPay = Math.round((grossPay - irpfAmount - ssAmount - otherDedAmount) * 100) / 100

      try {
      const payroll = await withPayrollWorkerLock(prisma, user.organizationId, worker.id, async (tx) => {
        await assertNoPaidOverlap(tx, user.organizationId!, worker.id, period)
        return tx.payroll.create({
        data: {
          workerId: worker.id,
          ...period,
          baseSalary: worker.baseSalary,
          irpfPercent: irpf,
          irpfAmount,
          socialSecurityPercent: SS_PERCENT,
          socialSecurityAmount: ssAmount,
          bonuses: bonusAmount,
          bonusesDesc: bonusDesc || undefined,
          otherDeductions: otherDedAmount,
          otherDeductionsDesc: otherDeductionsDesc || undefined,
          grossPay,
          netPay,
          organizationId: user.organizationId!,
        },
      })

      })
      created.push(payroll)
      } catch (error) {
        if (error instanceof PayrollPeriodError && error.status === 409) skipped.push(worker.name)
        else throw error
      }
    }

    revalidatePath('/nomina')
    return Response.json({
      created: created.length,
      skipped: skipped.length,
      skippedNames: skipped,
    })
  } catch (error) {
    return payrollErrorResponse(error, 'Error al generar la nómina')
  }
}
