import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { auditService } from '@/services/audit.service'

export const dynamic = 'force-dynamic'

const DELETION_WINDOW_DAYS = 30

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const userOrgId = session.user.organizationId

    if (!userOrgId) {
      return NextResponse.json(
        { error: 'Organización no encontrada' },
        { status: 400 }
      )
    }

    // Find the user and check deletion status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true, deletionRequestedAt: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Check if deletion was requested
    if (!user.deletionRequestedAt) {
      return NextResponse.json(
        { error: 'No hay solicitud de eliminación activa para cancelar' },
        { status: 400 }
      )
    }

    // Check if within the 30-day window
    const deletionDate = user.deletionRequestedAt
    const daysSinceDeletion = Math.floor(
      (Date.now() - deletionDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSinceDeletion > DELETION_WINDOW_DAYS) {
      return NextResponse.json(
        { error: 'La ventana de cancelación ha expirado. Los datos ya no se pueden recuperar.' },
        { status: 400 }
      )
    }

    // Clear the deletion timestamps
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: null,
        deletionRequestedAt: null,
      },
    })

    // Log the audit entry
    await auditService.log(
      'CONSENT_CHANGE',
      userId,
      userOrgId,
      { action: 'cancel_deletion', daysRemaining: DELETION_WINDOW_DAYS - daysSinceDeletion },
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      request.headers.get('user-agent') || undefined
    )

    return NextResponse.json({
      message: 'Solicitud de eliminación cancelada correctamente. Tu cuenta ha sido reactivada.',
    })
  } catch (error) {
    console.error('Cancel deletion error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
