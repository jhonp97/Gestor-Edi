import { NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
import { forgotPasswordSchema } from '@/schemas/auth.schema'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    await authService.requestPasswordReset(parsed.data.email)

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
