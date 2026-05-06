import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-edge'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { TruckMileageRepository } from '@/repositories/truck-mileage.repository'
import { TruckMileageService } from '@/services/truck-mileage.service'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; mileageId: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, mileageId } = await params

    // IDOR: verify truck belongs to org
    const truck = await prisma.truck.findFirst({
      where: { id, organizationId: user.organizationId },
    })
    if (!truck) {
      return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404 })
    }

    // Verify mileage record exists and belongs to this truck & org
    const mileage = await prisma.truckMileage.findFirst({
      where: {
        id: mileageId,
        truckId: id,
        organizationId: user.organizationId,
      },
    })
    if (!mileage) {
      return NextResponse.json(
        { error: 'Registro de kilometraje no encontrado' },
        { status: 404 }
      )
    }

    const repo = new TruckMileageRepository(user.organizationId)
    const service = new TruckMileageService(repo)

    await service.deleteMileage(mileageId)

    revalidatePath(`/trucks/${id}`)
    return NextResponse.json({ message: 'Registro de kilometraje eliminado' })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
