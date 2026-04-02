import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const existing = await prisma.worker.findUnique({
      where: { dni: body.dni.toUpperCase() },
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

export async function GET() {
  const workers = await prisma.worker.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return Response.json(workers)
}
