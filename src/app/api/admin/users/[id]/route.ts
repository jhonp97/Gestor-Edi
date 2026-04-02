import { NextResponse } from 'next/server'
import { authService, AuthError } from '@/services/auth.service'
import { changeRoleSchema } from '@/schemas/auth.schema'
import jwt from 'jsonwebtoken'
import type { AuthTokenPayload } from '@/types/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const COOKIE_NAME = 'auth-token'

function getUserFromRequest(request: Request): AuthTokenPayload | null {
  const cookie = request.headers.get('cookie')
  const token = cookie
    ?.split('; ')
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1]

  if (!token) return null

  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload
  } catch {
    return null
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const parsed = changeRoleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    await authService.changeUserRole(id, parsed.data.role)
    return NextResponse.json({ message: 'Rol actualizado' })
  } catch (error) {
    console.error('Admin change role error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = await params

    await authService.deleteUser(id, user.userId)
    return NextResponse.json({ message: 'Usuario eliminado' })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Admin delete user error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
