import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

const SS_PERCENT = 6.35

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workerId,
      month,
      year,
      baseSalary,
      irpfPercent = 15,
      bonusAmount = 0,
      bonusDesc = '',
      otherDeductions = 0,
      otherDeductionsDesc = '',
      notes = '',
    } = body

    if (!workerId || !month || !year || !baseSalary) {
      return Response.json(
        { error: 'Trabajador, mes, año y salario base son requeridos' },
        { status: 400 }
      )
    }

    // Verify worker belongs to this org
    const worker = await prisma.worker.findFirst({
      where: { id: workerId, organizationId: user.organizationId },
    })
    if (!worker) {
      return Response.json({ error: 'Trabajador no encontrado' }, { status: 404 })
    }

    // Check if payroll already exists for this worker/month/year
    const existing = await prisma.payroll.findFirst({
      where: {
        workerId,
        month,
        year,
        organizationId: user.organizationId,
      },
    })

    if (existing) {
      return Response.json(
        { error: 'Ya existe una nómina para este trabajador en ese período' },
        { status: 409 }
      )
    }

    const irpfAmount = Math.round(baseSalary * (irpfPercent / 100) * 100) / 100
    const ssAmount = Math.round(baseSalary * (SS_PERCENT / 100) * 100) / 100
    const grossPay = Math.round((baseSalary + bonusAmount) * 100) / 100
    const netPay = Math.round((grossPay - irpfAmount - ssAmount - otherDeductions) * 100) / 100

    const payroll = await prisma.payroll.create({
      data: {
        workerId,
        month,
        year,
        baseSalary,
        irpfPercent,
        irpfAmount,
        socialSecurityPercent: SS_PERCENT,
        socialSecurityAmount: ssAmount,
        bonuses: bonusAmount,
        bonusesDesc: bonusDesc || undefined,
        otherDeductions,
        otherDeductionsDesc: otherDeductionsDesc || undefined,
        grossPay,
        netPay,
        notes: notes || undefined,
        organizationId: user.organizationId,
      },
      include: { worker: true },
    })

    revalidatePath('/nomina')
    return Response.json(payroll)
  } catch (error) {
    console.error('Error generating individual payroll:', error)
    return Response.json(
      { error: 'Error al generar la nómina' },
      { status: 500 }
    )
  }
}
