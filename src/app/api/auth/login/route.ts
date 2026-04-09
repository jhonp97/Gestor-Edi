import { NextResponse } from 'next/server'
import { authService, AuthError } from '@/services/auth.service'
import { loginSchema } from '@/schemas/auth.schema'

const COOKIE_NAME = 'auth-token'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days for testing
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    // Login
    const result = await authService.login(email, password)
    console.log('Login success, token:', result.token.substring(0, 20) + '...')

    // Create response with cookie
    const response = NextResponse.json({ 
      user: result.user
    })

    // Set cookie with explicit options for development
    response.cookies.set(COOKIE_NAME, result.token, {
      ...COOKIE_OPTIONS,
      sameSite: 'lax',
    })

    console.log('Cookie set:', COOKIE_NAME, 'options:', COOKIE_OPTIONS)

    return response
  } catch (error) {
    if (error instanceof AuthError) {
      // Determine which field the error applies to
      if (error.code === 'EMAIL_NOT_FOUND' || error.code === 'EMAIL_EXISTS') {
        return NextResponse.json({ 
          error: error.message, 
          field: 'email' 
        }, { status: 401 })
      }
      if (error.code === 'INVALID_PASSWORD' || error.code === 'WRONG_PASSWORD') {
        return NextResponse.json({ 
          error: error.message, 
          field: 'password' 
        }, { status: 401 })
      }
      // Generic credentials error
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
