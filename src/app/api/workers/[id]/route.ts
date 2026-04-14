import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { WorkerRepository } from '@/repositories/worker.repository'
import { WorkerService } from '@/services/worker.service'
import { getEncryptionService } from '@/services/encryption.service'

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
    const repo = new WorkerRepository(user.organizationId)
    const service = new WorkerService(repo)

    await service.delete(id)

    revalidatePath('/workers')
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting worker:', error)
    if (error instanceof Error && error.message === 'Not found') {
      return Response.json({ error: 'Trabajador no encontrado' }, { status: 404 })
    }
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
    const repo = new WorkerRepository(user.organizationId)
    const service = new WorkerService(repo)

    // Validate truckId belongs to same org
    if (body.truckId) {
      const truck = await prisma.truck.findFirst({
        where: { id: body.truckId, organizationId: user.organizationId },
      })
      if (!truck) {
        return Response.json(
          { error: 'El camión seleccionado no pertenece a tu organización' },
          { status: 403 }
        )
      }
    }

    const { dni, ...updateData } = body
    const updatePayload: Record<string, unknown> = { ...updateData }
    
    if (dni) {
      updatePayload.dni = dni.toUpperCase()
    }
    if (body.baseSalary !== undefined) {
      updatePayload.baseSalary = Number(body.baseSalary)
    }
    if (body.startDate !== undefined) {
      updatePayload.startDate = new Date(body.startDate)
    }
    if (body.endDate !== undefined) {
      updatePayload.endDate = body.endDate ? new Date(body.endDate) : null
    }

    const worker = await service.update(id, updatePayload as Parameters<typeof service.update>[1])

    if (!worker) {
      return Response.json({ error: 'Trabajador no encontrado' }, { status: 404 })
    }

    revalidatePath('/workers')
    revalidatePath(`/workers/${id}`)
    return Response.json(worker)
  } catch (error) {
    console.error('Error updating worker:', error)
    if (error instanceof Error && error.message.includes('Ya existe')) {
      return Response.json({ error: error.message }, { status: 409 })
    }
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
  const repo = new WorkerRepository(user.organizationId)
  const service = new WorkerService(repo)
  const enc = getEncryptionService()

  const worker = await service.getById(id)

  if (!worker) {
    return Response.json({ error: 'Trabajador no encontrado' }, { status: 404 })
  }

  // PLATFORM_ADMIN viewing worker from other org — mask DNI
  if (user.role === 'PLATFORM_ADMIN') {
    if (worker.dni && worker.dni.includes(':')) {
      try {
        const decrypted = await enc.decryptWorkerDni(worker.dni)
        return Response.json({ ...worker, dni: enc.maskWorkerDni(decrypted) })
      } catch {
        return Response.json({ ...worker, dni: enc.maskWorkerDni(worker.dni) })
      }
    }
  }

  return Response.json(worker)
}
