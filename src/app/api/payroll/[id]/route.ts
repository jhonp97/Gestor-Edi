import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { deletePendingPayroll, payrollErrorResponse } from '@/lib/payroll-period'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user?.organizationId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 })
    const payroll = await deletePendingPayroll(prisma, user.organizationId, id)
    revalidatePath('/nomina')
    revalidatePath(`/nomina/${id}`)
    revalidatePath(`/workers/${payroll.workerId}`)
    return Response.json({ success: true })
  } catch (error) {
    return payrollErrorResponse(error, 'Error al eliminar la nómina')
  }
}
