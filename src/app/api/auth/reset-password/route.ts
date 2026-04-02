import { NextResponse } from 'next/server'
import { authService, AuthError } from '@/services/auth.service'
import { resetPasswordSchema } from '@/schemas/auth.schema'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    await authService.resetPassword(parsed.data.token, parsed.data.password)

    return NextResponse.json({ message: 'Contraseña actualizada exitosamente' })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
