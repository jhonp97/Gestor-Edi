import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { auditService } from '@/services/audit.service'
import { LastAdminError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

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

    // Check if user is the last ORG_ADMIN in their organization
    const adminCount = await prisma.user.count({
      where: {
        organizationId: userOrgId,
        role: 'ORG_ADMIN',
        id: { not: userId }, // Exclude current user
        deletedAt: null,
      },
    })

    // If there are no other admins, and the user is requesting deletion, block it
    // Note: If adminCount is 0, the user IS the last admin
    if (adminCount === 0) {
      throw new LastAdminError('No puedes solicitar la eliminación de tu cuenta si eres el último administrador de la organización')
    }

    const now = new Date()

    // Set soft-delete timestamps
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
        deletionRequestedAt: now,
      },
    })

    // Log the audit entry
    await auditService.log(
      'DATA_DELETE_REQUEST',
      userId,
      userOrgId,
      {},
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      request.headers.get('user-agent') || undefined
    )

    return NextResponse.json({
      message: 'Solicitud de eliminación procesada correctamente. Tus datos serán eliminados permanentemente después de 30 días si no cancelas la solicitud.',
      deletionRequestedAt: now.toISOString(),
    })
  } catch (error) {
    console.error('Delete request error:', error)

    if (error instanceof LastAdminError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
