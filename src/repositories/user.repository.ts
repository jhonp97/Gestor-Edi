import { BaseRepository } from './base.repository'
import type { User, CreateUserInput } from '@/types/auth'

export class UserRepository extends BaseRepository {
  async findAll(): Promise<Omit<User, 'password'>[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        role: true,
        image: true,
        phone: true,
        phoneVerified: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        language: true,
        notificationsEnabled: true,
        emailNotifications: true,
        smsNotifications: true,
        gdprConsentGiven: true,
        gdprConsentDate: true,
        organizationId: true,
        deletedAt: true,
        deletionRequestedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    })
  }

  async create(data: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: data as User & CreateUserInput,
    })
  }

  async update(id: string, data: Partial<CreateUserInput>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    })
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    })
  }

  async updateRole(id: string, role: 'USER' | 'ORG_ADMIN' | 'PLATFORM_ADMIN'): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    })
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    })
  }

  async count(): Promise<number> {
    return this.prisma.user.count()
  }
}
