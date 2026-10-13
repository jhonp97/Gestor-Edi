import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { payPayroll, payrollErrorResponse } from '@/lib/payroll-period'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 })
    const payroll = await payPayroll(prisma, user.organizationId, id)
    revalidatePath('/nomina')
    revalidatePath(`/nomina/${id}`)
    return Response.json(payroll)
  } catch (error) {
    return payrollErrorResponse(error, 'Error al marcar como pagado')
  }
}
