import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

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

    const existing = await prisma.worker.findFirst({
      where: { id, organizationId: user.organizationId },
    })
    if (!existing) {
      return Response.json({ error: 'Trabajador no encontrado' }, { status: 404 })
    }

    await prisma.worker.delete({ where: { id } })

    revalidatePath('/workers')
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting worker:', error)
    return Response.json(
      { error: 'Error al eliminar el trabajador' },
      { status: 500 }
    )
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

    const { dni, ...updateData } = body

    const existingWorker = await prisma.worker.findFirst({
      where: { id, organizationId: user.organizationId },
    })
    if (!existingWorker) {
      return Response.json({ error: 'Trabajador no encontrado' }, { status: 404 })
    }

    // Check DNI uniqueness if changed
    if (dni) {
      const existing = await prisma.worker.findFirst({
        where: {
          dni: dni.toUpperCase(),
          organizationId: user.organizationId,
        },
      })
      if (existing && existing.id !== id) {
        return Response.json(
          { error: 'Ya existe un trabajador con ese DNI' },
          { status: 409 }
        )
      }
    }

    const worker = await prisma.worker.update({
      where: { id },
      data: {
        ...updateData,
        dni: dni ? dni.toUpperCase() : undefined,
        baseSalary: body.baseSalary ? Number(body.baseSalary) : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate !== undefined
          ? (body.endDate ? new Date(body.endDate) : null)
          : undefined,
      },
    })

    revalidatePath('/workers')
    revalidatePath(`/workers/${id}`)
    return Response.json(worker)
  } catch (error) {
    console.error('Error updating worker:', error)
    return Response.json(
      { error: 'Error al actualizar el trabajador' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request)
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const worker = await prisma.worker.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { truck: true },
  })

  if (!worker) {
    return Response.json({ error: 'Trabajador no encontrado' }, { status: 404 })
  }

  return Response.json(worker)
}
