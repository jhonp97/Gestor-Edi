import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session-api'
import { consentService } from '@/services/consent.service'
import { ConsentInputSchema } from '@/schemas/consent.schema'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = ConsentInputSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Get optional user session info
    const session = await getSessionFromRequest(request)
    const userId = session?.user?.id
    const organizationId = session?.user?.organizationId

    // Get IP and User-Agent from request headers
    const ip = request.headers.get('x-forwarded-for')
      || request.headers.get('x-real-ip')
      || undefined
    const userAgent = request.headers.get('user-agent') || undefined

    const consentLog = await consentService.recordConsent({
      userId: userId || undefined,
      categories: parsed.data.categories,
      ip,
      userAgent,
      organizationId: organizationId || undefined,
    })

    return NextResponse.json(
      {
        id: consentLog.id,
        userId: consentLog.userId,
        categories: consentLog.categories,
        timestamp: consentLog.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Consent POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
