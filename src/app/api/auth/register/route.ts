import { NextResponse } from 'next/server'
import { authService, AuthError } from '@/services/auth.service'
import { registerSchema } from '@/schemas/auth.schema'

const COOKIE_NAME = 'auth-token'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 8 * 60 * 60, // 8 hours in seconds
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { name, email, password } = parsed.data

    // Register user
    const result = await authService.register(name, email, password)

    // Create response with cookie
    const response = NextResponse.json(
      { user: result.user },
      { status: 201 }
    )

    response.cookies.set(COOKIE_NAME, result.token, COOKIE_OPTIONS)

    return response
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
