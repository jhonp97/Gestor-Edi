import { BaseRepository } from './base.repository'
import type { User } from '@prisma/client'

export class UserProfileRepository extends BaseRepository {
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async updateProfile(id: string, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({ where: { id }, data })
  }

  async updatePhone(id: string, phone: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { phone } })
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { password: hashedPassword } })
  }

  async updatePreferences(
    id: string,
    data: Partial<Pick<User, 'language' | 'notificationsEnabled' | 'emailNotifications' | 'smsNotifications'>>
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data })
  }
}
