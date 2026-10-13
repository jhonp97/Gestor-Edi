import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { accruedTotals, formatCivilDate, toMoney } from '@/lib/daily-pay'
import { resolvePayrollPeriod, payrollErrorResponse } from '@/lib/payroll-period'

/** Read-only accrual from immutable daily snapshots, with inclusive civil dates. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user?.organizationId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const query = new URL(request.url).searchParams
    const period = resolvePayrollPeriod({ periodStart: query.get('periodStart'), periodEnd: query.get('periodEnd') })
    const { id } = await params
    const worker = await prisma.worker.findFirst({ where: { id, organizationId: user.organizationId } })
    if (!worker) return Response.json({ error: 'Trabajador no encontrado' }, { status: 404 })
    const rows = await prisma.dailyPayDay.findMany({
      where: { workerId: id, organizationId: user.organizationId, workDate: { gte: period.periodStart, lte: period.periodEnd } },
      orderBy: { workDate: 'asc' },
    })
    const days = rows.map((day) => ({ date: formatCivilDate(day.workDate), rateSnapshot: toMoney(day.rateSnapshot) }))
    return Response.json({ workerId: id, periodStart: formatCivilDate(period.periodStart), periodEnd: formatCivilDate(period.periodEnd), days, totals: accruedTotals(days.map((day) => day.rateSnapshot)) })
  } catch (error) {
    return payrollErrorResponse(error, 'Error al consultar los días trabajados')
  }
}
