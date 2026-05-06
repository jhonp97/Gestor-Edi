import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-edge'
import { TransactionService } from '@/services/transaction.service'
import { TransactionRepository } from '@/repositories/transaction.repository'
import { prisma } from '@/lib/prisma'
import { createTransactionSchema } from '@/schemas'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate truckId belongs to user's organization (IDOR prevention)
    if (body.truckId) {
      const truck = await prisma.truck.findFirst({
        where: { id: body.truckId, organizationId: user.organizationId },
      })
      if (!truck) {
        return NextResponse.json(
          { error: 'El camión seleccionado no pertenece a tu organización' },
          { status: 403 }
        )
      }
    }

    const validated = createTransactionSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.issues[0].message },
        { status: 400 }
      )
    }

    const service = new TransactionService(new TransactionRepository(user.organizationId))
    const transaction = await service.create(validated.data)
    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
