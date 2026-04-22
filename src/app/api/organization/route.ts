import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session-api'
import { organizationService } from '@/services/organization.service'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const canEdit = session.user.role === 'ORG_ADMIN' || session.user.role === 'PLATFORM_ADMIN'
    if (!canEdit) {
      return NextResponse.json({ error: 'No tenés permisos para editar la organización' }, { status: 403 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ error: 'No tenés organización asociada' }, { status: 400 })
    }

    const updated = await organizationService.update(session.user.organizationId, name.trim())

    return NextResponse.json({ organization: { id: updated.id, name: updated.name } })
  } catch (error) {
    console.error('Organization PATCH error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
