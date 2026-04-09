import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Aquí le pasamos explícitamente la variable de entorno a Prisma
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma