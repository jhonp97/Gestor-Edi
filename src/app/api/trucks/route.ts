import { NextResponse } from 'next/server'
import { TruckService } from '@/services/truck.service'
import { TruckRepository } from '@/repositories/truck.repository'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const service = new TruckService(new TruckRepository())
    const truck = await service.create(body)
    return NextResponse.json(truck, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
