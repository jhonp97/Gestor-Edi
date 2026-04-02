import { NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
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

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const users = await authService.getAllUsers()
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Admin get users error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
