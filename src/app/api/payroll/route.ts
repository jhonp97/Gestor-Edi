import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  const where: Record<string, unknown> = { organizationId: user.organizationId }
  if (month) where.month = parseInt(month)
  if (year) where.year = parseInt(year)

  const payrolls = await prisma.payroll.findMany({
    where,
    include: { worker: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })

  return Response.json(payrolls)
}
