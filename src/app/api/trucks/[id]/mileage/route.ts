import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-edge'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { createMileageSchema } from '@/schemas'
import { TruckMileageRepository } from '@/repositories/truck-mileage.repository'
import { TruckMileageService } from '@/services/truck-mileage.service'

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

    // IDOR: verify truck belongs to org
    const truck = await prisma.truck.findFirst({
      where: { id, organizationId: user.organizationId },
    })
    if (!truck) {
      return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404 })
    }

    const body = await request.json()

    const validated = createMileageSchema.safeParse({
      ...body,
      truckId: id,
    })
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      )
    }

    const repo = new TruckMileageRepository(user.organizationId)
    const service = new TruckMileageService(repo)

    const record = await service.createMileage({
      ...validated.data,
      organizationId: user.organizationId,
    })

    revalidatePath(`/trucks/${id}`)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode === 409) {
      return NextResponse.json(
        { error: 'Ya existe un registro de kilometraje para esta fecha' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

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

    // IDOR: verify truck belongs to org
    const truck = await prisma.truck.findFirst({
      where: { id, organizationId: user.organizationId },
    })
    if (!truck) {
      return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404 })
    }

    const url = new URL(request.url)
    const year = url.searchParams.get('year')
    const month = url.searchParams.get('month')

    const repo = new TruckMileageRepository(user.organizationId)
    const service = new TruckMileageService(repo)

    const result = await service.getMileageHistory(
      id,
      year ? parseInt(year) : undefined,
      month ? parseInt(month) : undefined
    )

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
