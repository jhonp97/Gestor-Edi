import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return Response.json({ error: 'ID requerido' }, { status: 400 })
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
