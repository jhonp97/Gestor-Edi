import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return Response.json({ error: 'ID requerido' }, { status: 400 })
    }

    const existing = await prisma.payroll.findFirst({
      where: { id, organizationId: user.organizationId },
    })
    if (!existing) {
      return Response.json({ error: 'Nómina no encontrada' }, { status: 404 })
    }

    const payroll = await prisma.payroll.update({
      where: { id },
      data: { paidAt: new Date() },
      include: { worker: true },
    })

    revalidatePath('/nomina')
    revalidatePath(`/nomina/${id}`)
    return Response.json(payroll)
  } catch {
    return Response.json(
      { error: 'Error al marcar como pagado' },
      { status: 500 }
    )
  }
}
