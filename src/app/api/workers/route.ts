import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth-edge'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { WorkerRepository } from '@/repositories/worker.repository'
import { WorkerService } from '@/services/worker.service'
import { getEncryptionService } from '@/services/encryption.service'
import type { Worker } from '@prisma/client'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const repo = new WorkerRepository(user.organizationId)
    const service = new WorkerService(repo)

    // Check truck ownership
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

    // WorkerService handles encryption via WorkerRepository
    const worker = await service.create({
      name: body.name,
      dni: body.dni.toUpperCase(),
      position: body.position,
      baseSalary: Number(body.baseSalary),
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      status: body.status ?? 'ACTIVE',
      truckId: body.truckId || null,
    })

    revalidatePath('/workers')
    return Response.json(worker, { status: 201 })
  } catch (error) {
    console.error('Error creating worker:', error)
    if (error instanceof Error && error.message.includes('Ya existe')) {
      return Response.json({ error: error.message }, { status: 409 })
    }
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

  const repo = new WorkerRepository(user.organizationId)
  const service = new WorkerService(repo)
  const enc = getEncryptionService()

  let workers = await service.getAll()

  // PLATFORM_ADMIN can see workers from other orgs — mask DNI
  const isPlatformAdminCrossOrg = user.role === 'PLATFORM_ADMIN'
  if (isPlatformAdminCrossOrg) {
    workers = await maskWorkersDni(workers, enc)
  }

  return Response.json(workers)
}

/**
 * Mask DNI for all workers (used when PLATFORM_ADMIN views cross-org data).
 * The DNI is encrypted in DB, so we decrypt it first, then mask.
 */
async function maskWorkersDni(workers: Worker[], enc: ReturnType<typeof getEncryptionService>): Promise<Worker[]> {
  const result: Worker[] = []
  for (const w of workers) {
    // Only mask if DNI is actually set and looks encrypted
    if (w.dni && w.dni.includes(':')) {
      try {
        const decrypted = await enc.decryptWorkerDni(w.dni)
        result.push({ ...w, dni: enc.maskWorkerDni(decrypted) })
      } catch {
        // If decryption fails, mask the raw value
        result.push({ ...w, dni: enc.maskWorkerDni(w.dni) })
      }
    } else {
      result.push(w)
    }
  }
  return result
}
