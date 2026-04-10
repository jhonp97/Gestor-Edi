import { jwtVerify } from 'jose'
import type { AuthTokenPayload } from '@/types/auth'

const COOKIE_NAME = 'auth-token'

export async function getUserFromRequest(request: Request): Promise<AuthTokenPayload | null> {
  const cookie = request.headers.get('cookie')
  const token = cookie
    ?.split('; ')
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1]

  if (!token) return null

  try {
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production'
    )
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as AuthTokenPayload
  } catch {
    return null
  }
}