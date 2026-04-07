import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const SS_PERCENT = 6.35

export async function POST(request: Request) {
  try {
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

    const irpf = irpfPercent ?? 15
    const activeWorkers = await prisma.worker.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    })

    const created = []
    const skipped = []

    for (const worker of activeWorkers) {
      const existing = await prisma.payroll.findUnique({
        where: {
          workerId_month_year: {
            workerId: worker.id,
            month,
            year,
          },
        },
      })

      if (existing) {
        skipped.push(worker.name)
        continue
      }

      // Calculate amounts
      const irpfAmount = Math.round(worker.baseSalary * (irpf / 100) * 100) / 100
      const ssAmount = Math.round(worker.baseSalary * (SS_PERCENT / 100) * 100) / 100
      const bonusAmount = Math.round(worker.baseSalary * (bonusPercent / 100) * 100) / 100
      const otherDedAmount = Math.round(worker.baseSalary * (otherDeductionsPercent / 100) * 100) / 100
      
      // Gross = base + bonuses
      const grossPay = Math.round((worker.baseSalary + bonusAmount) * 100) / 100
      
      // Net = gross - all deductions
      const netPay = Math.round((grossPay - irpfAmount - ssAmount - otherDedAmount) * 100) / 100

      const payroll = await prisma.payroll.create({
        data: {
          workerId: worker.id,
          month,
          year,
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
        },
      })

      created.push(payroll)
    }

    revalidatePath('/nomina')
    return Response.json({
      created: created.length,
      skipped: skipped.length,
      skippedNames: skipped,
    })
  } catch (error) {
    console.error('Error generating payroll:', error)
    return Response.json(
      { error: 'Error al generar la nómina' },
      { status: 500 }
    )
  }
}
