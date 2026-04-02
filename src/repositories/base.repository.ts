import { prisma } from '@/lib/prisma'

export abstract class BaseRepository {
  protected prisma = prisma
}
