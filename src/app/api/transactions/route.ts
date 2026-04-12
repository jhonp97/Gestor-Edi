import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-edge'
import { TransactionService } from '@/services/transaction.service'
import { TransactionRepository } from '@/repositories/transaction.repository'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const service = new TransactionService(new TransactionRepository(user.organizationId))
    const transaction = await service.create(body)
    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
