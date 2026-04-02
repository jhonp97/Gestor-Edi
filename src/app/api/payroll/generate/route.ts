import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const SS_PERCENT = 6.35

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { month, year, irpfPercent } = body

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

      const irpfAmount = Math.round(worker.baseSalary * (irpf / 100) * 100) / 100
      const ssAmount = Math.round(worker.baseSalary * (SS_PERCENT / 100) * 100) / 100
      const grossPay = worker.baseSalary
      const netPay = Math.round((grossPay - irpfAmount - ssAmount) * 100) / 100

      const payroll = await prisma.payroll.create({
        data: {
          workerId: worker.id,
          month,
          year,
          baseSalary: grossPay,
          irpfPercent: irpf,
          irpfAmount,
          socialSecurityPercent: SS_PERCENT,
          socialSecurityAmount: ssAmount,
          otherDeductions: 0,
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
