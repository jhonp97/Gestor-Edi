import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-edge'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { updateTruckSchema } from '@/schemas'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const truck = await prisma.truck.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        workers: true,
        transactions: { orderBy: { date: 'desc' } },
      },
    })
    if (!truck) {
      return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404 })
    }
    return NextResponse.json(truck)
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const validated = updateTruckSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.issues[0].message },
        { status: 400 }
      )
    }

    const { plate, brand, model, year, status } = validated.data

    const existing = await prisma.truck.findFirst({
      where: { id, organizationId: user.organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404 })
    }

    const truck = await prisma.truck.update({
      where: { id },
      data: {
        ...(plate && { plate }),
        ...(brand && { brand }),
        ...(model && { model }),
        ...(year && { year: Number(year) }),
        ...(status && { status }),
      },
    })

    revalidatePath('/trucks')
    revalidatePath(`/trucks/${id}`)
    return NextResponse.json(truck)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Esa matrícula ya existe' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    let confirmHistoryDeletion = false
    try {
      const text = await request.text()
      if (text.trim()) {
        const body: unknown = JSON.parse(text)
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
        }
        if ('confirmHistoryDeletion' in body) {
          if (typeof body.confirmHistoryDeletion !== 'boolean') {
            return NextResponse.json({ error: 'Confirmación inválida' }, { status: 400 })
          }
          confirmHistoryDeletion = body.confirmHistoryDeletion
        }
      }
    } catch {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const organizationId = user.organizationId
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.truck.findFirst({ where: { id, organizationId } })
      if (!existing) return 'not-found'

      const where = { truckId: id, organizationId }
      const historyCount = await tx.workerDayTruckSegment.count({ where })
      if (historyCount && !confirmHistoryDeletion) return 'confirmation-required'
      if (historyCount) {
        await tx.workerDayTruckSegment.deleteMany({ where })
      }
      // Retain operation containers and their payable days/rate snapshots, even
      // when empty. Other trucks' shares must not be renormalized.
      await tx.truck.delete({ where: { id, organizationId } })
      return 'deleted'
    })
    if (result === 'not-found') {
      return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404 })
    }
    if (result === 'confirmation-required') {
      return NextResponse.json({
        error: 'El camión tiene historial operativo. Confirma su eliminación irreversible.',
        code: 'HISTORY_DELETION_CONFIRMATION_REQUIRED',
      }, { status: 409 })
    }
    revalidatePath('/trucks')
    return NextResponse.json({ message: 'Camión eliminado' })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error &&
        (error.code === 'P2003' || error.code === 'P2034' || error.code === 'P2025')) {
      return NextResponse.json({ error: 'El camión cambió o tiene vínculos activos. Vuelve a intentarlo.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
