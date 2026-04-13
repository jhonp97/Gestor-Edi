import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DELETION_WINDOW_DAYS = 30

export async function DELETE(request: Request) {
  try {
    // Verify CRON_SECRET from Authorization header
    const authHeader = request.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Configuración del servidor incorrecta' },
        { status: 500 }
      )
    }

    // Check Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    if (token !== cronSecret) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Calculate the cutoff date (30 days ago)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - DELETION_WINDOW_DAYS)

    // Find users eligible for purge
    const usersToPurge = await prisma.user.findMany({
      where: {
        deletedAt: {
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
        email: true,
        deletedAt: true,
      },
    })

    if (usersToPurge.length === 0) {
      return NextResponse.json({
        message: 'No se encontraron usuarios para purgar',
        purgedCount: 0,
      })
    }

    // Hard delete each user (cascading deletes via Prisma relations)
    const purgePromises = usersToPurge.map(async (user) => {
      try {
        await prisma.user.delete({
          where: { id: user.id },
        })
        return { id: user.id, email: user.email, success: true }
      } catch (error) {
        console.error(`Failed to purge user ${user.id}:`, error)
        return { id: user.id, email: user.email, success: false }
      }
    })

    const results = await Promise.all(purgePromises)
    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    console.log(`Purge completed: ${successCount} users deleted, ${failCount} failures`)

    return NextResponse.json({
      message: 'Purga completada',
      purgedCount: successCount,
      failedCount: failCount,
      results,
    })
  } catch (error) {
    console.error('Purge error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
