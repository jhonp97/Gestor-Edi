import bcrypt from 'bcryptjs'
import { UserProfileRepository } from '@/repositories/user-profile.repository'
import { ProfileError } from '@/lib/errors'
import type { User } from '@prisma/client'

const BCRYPT_COST = 12

export class ProfileService {
  private repo = new UserProfileRepository()

  async getProfile(userId: string): Promise<Omit<User, 'password'>> {
    const user = await this.repo.findById(userId)
    if (!user) {
      throw new ProfileError('Usuario no encontrado')
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...profile } = user
    return profile
  }

  async updateProfile(userId: string, data: Partial<Pick<User, 'name' | 'phone' | 'image'>>) {
    return this.repo.updateProfile(userId, data)
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repo.findById(userId)
    if (!user) {
      throw new ProfileError('Usuario no encontrado')
    }

    if (!user.password) {
      throw new ProfileError('Autenticación por Google — no se puede cambiar la contraseña aquí')
    }

    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      throw new ProfileError('Contraseña actual incorrecta')
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST)
    await this.repo.updatePassword(userId, hashedPassword)
  }

  async updatePreferences(
    userId: string,
    data: Partial<Pick<User, 'language' | 'notificationsEnabled' | 'emailNotifications' | 'smsNotifications'>>
  ) {
    return this.repo.updatePreferences(userId, data)
  }
}

export const profileService = new ProfileService()
