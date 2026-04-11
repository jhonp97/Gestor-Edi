import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const truck = await prisma.truck.findUnique({
      where: { id },
      include: {
        workers: true,
        transactions: { orderBy: { date: 'desc' } },
      },
    })
    if (!truck) {
      return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404 })
    }
    return NextResponse.json(truck)
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { plate, brand, model, year, status } = body

    const truck = await prisma.truck.update({
      where: { id },
      data: {
        ...(plate && { plate }),
        ...(brand && { brand }),
        ...(model && { model }),
        ...(year && { year: Number(year) }),
        ...(status && { status }),
      },
    })

    revalidatePath('/trucks')
    revalidatePath(`/trucks/${id}`)
    return NextResponse.json(truck)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Esa matrícula ya existe' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.truck.delete({ where: { id } })
    revalidatePath('/trucks')
    return NextResponse.json({ message: 'Camión eliminado' })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}