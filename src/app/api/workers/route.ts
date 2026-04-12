import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const existing = await prisma.worker.findFirst({
      where: {
        dni: body.dni.toUpperCase(),
        organizationId: user.organizationId,
      },
    })

    if (existing) {
      return Response.json(
        { error: 'Ya existe un trabajador con ese DNI' },
        { status: 409 }
      )
    }

    const worker = await prisma.worker.create({
      data: {
        name: body.name,
        dni: body.dni.toUpperCase(),
        position: body.position,
        baseSalary: Number(body.baseSalary),
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: body.status ?? 'ACTIVE',
        truckId: body.truckId || null,
        organizationId: user.organizationId,
      },
    })

    revalidatePath('/workers')
    return Response.json(worker, { status: 201 })
  } catch (error) {
    console.error('Error creating worker:', error)
    return Response.json(
      { error: 'Error al crear el trabajador' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workers = await prisma.worker.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: 'desc' },
  })
  return Response.json(workers)
}
