import { NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
import { getUserFromRequest } from '@/lib/auth-edge'

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const users = await authService.getAllUsers()
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Admin get users error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}