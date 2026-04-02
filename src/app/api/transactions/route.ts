import { NextResponse } from 'next/server'
import { TransactionService } from '@/services/transaction.service'
import { TransactionRepository } from '@/repositories/transaction.repository'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const service = new TransactionService(new TransactionRepository())
    const transaction = await service.create(body)
    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
