import { BaseRepository } from './base.repository'
import type { PasswordResetToken } from '@prisma/client'

export class PasswordResetTokenRepository extends BaseRepository {
  async findByToken(token: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })
  }

  async create(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    })
  }

  async markAsUsed(id: string): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { used: true },
    })
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })
    return result.count
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: { userId },
    })
    return result.count
  }
}
