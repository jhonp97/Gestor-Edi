/**
 * Role Migration Script: ADMIN → ORG_ADMIN
 * 
 * Este script migra todos los usuarios con rol ADMIN al nuevo rol ORG_ADMIN.
 * Se ejecuta durante el maintenance window de Phase 2.
 * 
 * Uso: npx tsx prisma/migrate-roles.ts
 * 
 * ⚠️  IMPORTANTE: Ejecutar DESPUÉS de aplicar el nuevo schema de Prisma en producción.
 *    Este script usa raw SQL porque el enum ADMIN ya no existe en los tipos de Prisma.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateRoles() {
  console.log('🔄 Iniciando migración de roles: ADMIN → ORG_ADMIN')
  console.log('─'.repeat(50))

  try {
    // 1. Contar usuarios con rol ADMIN antes de la migración
    // Usamos raw SQL porque 'ADMIN' ya no existe en el enum de Prisma
    const adminCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "User" WHERE role = 'ADMIN'
    `
    const adminCount = Number(adminCountResult[0]?.count ?? 0)
    console.log(`📊 Usuarios con rol ADMIN actualmente: ${adminCount}`)

    if (adminCount === 0) {
      console.log('✅ No hay usuarios con rol ADMIN. Nada que migrar.')
      return
    }

    // 2. Ejecutar la migración con raw SQL
    await prisma.$executeRaw`
      UPDATE "User" SET role = 'ORG_ADMIN' WHERE role = 'ADMIN'
    `
    console.log(`✅ Migrados ${adminCount} usuario(s) de ADMIN → ORG_ADMIN`)

    // 3. Verificar que la migración fue exitosa
    const remainingResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "User" WHERE role = 'ADMIN'
    `
    const remainingAdmin = Number(remainingResult[0]?.count ?? 0)
    const newOrgAdmin = await prisma.user.count({
      where: { role: 'ORG_ADMIN' },
    })

    console.log('─'.repeat(50))
    console.log('📊 Resumen post-migración:')
    console.log(`   ADMIN:     ${remainingAdmin}`)
    console.log(`   ORG_ADMIN: ${newOrgAdmin}`)

    if (remainingAdmin > 0) {
      console.error('❌ ERROR: Aún quedan usuarios con rol ADMIN. Revisar la migración.')
      process.exit(1)
    }

    console.log('✅ Migración completada exitosamente.')
  } catch (error) {
    console.error('❌ Error durante la migración:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateRoles()
