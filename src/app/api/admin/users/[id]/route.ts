import { NextResponse } from 'next/server'
import { authService, AuthError } from '@/services/auth.service'
import { changeRoleSchema } from '@/schemas/auth.schema'
import { getUserFromRequest } from '@/lib/auth-edge'
import { rateLimit } from '@/lib/rate-limit'
import { ADMIN_RATE_LIMIT } from '@/config/rate-limits'

// Helper function to extract IP from request
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    ?? request.headers.get('x-real-ip') 
    ?? 'unknown'
}

// Helper function to create rate limit response
function rateLimitResponse(resetAt: number, remaining: number) {
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(ADMIN_RATE_LIMIT.maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  }
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
  return {
    response: NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { 
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Retry-After': String(retryAfter),
        }
      }
    ),
    headers: rateLimitHeaders,
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting BEFORE auth check
  const ip = getClientIp(request)
  const { success, remaining, resetAt } = rateLimit(`admin:users-patch:${ip}`, ADMIN_RATE_LIMIT)

  if (!success) {
    return rateLimitResponse(resetAt, remaining).response
  }

  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = changeRoleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    await authService.changeUserRole(id, parsed.data.role)
    return NextResponse.json({ message: 'Rol actualizado' }, { 
      headers: { 
        'X-RateLimit-Limit': String(ADMIN_RATE_LIMIT.maxRequests),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      }
    })
  } catch (error) {
    console.error('Admin change role error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting BEFORE auth check
  const ip = getClientIp(request)
  const { success, remaining, resetAt } = rateLimit(`admin:users-delete:${ip}`, ADMIN_RATE_LIMIT)

  if (!success) {
    return rateLimitResponse(resetAt, remaining).response
  }

  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = await params
    await authService.deleteUser(id, user.userId)
    return NextResponse.json({ message: 'Usuario eliminado' }, { 
      headers: { 
        'X-RateLimit-Limit': String(ADMIN_RATE_LIMIT.maxRequests),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      }
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Admin delete user error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}