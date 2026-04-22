import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}))

import { ProfileService } from '@/services/profile.service'
import bcrypt from 'bcryptjs'
import { ProfileError } from '@/lib/errors'
import { prisma as mockPrisma } from '@/lib/prisma'

const mockPrismaUser = mockPrisma.user

describe('ProfileService', () => {
  let service: ProfileService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProfileService()
  })

  describe('getProfile', () => {
    it('debería retornar perfil sin password', async () => {
      const user = {
        id: 'u1',
        name: 'Test',
        email: 'test@test.com',
        password: 'secret',
        phone: '+34612345678',
        role: 'USER',
        organizationId: 'org-1',
        image: null,
        language: 'es',
        notificationsEnabled: true,
        emailNotifications: true,
        smsNotifications: false,
        gdprConsentGiven: false,
        twoFactorEnabled: false,
        twoFactorMethod: 'NONE',
        phoneVerified: null,
        gdprConsentDate: null,
        deletedAt: null,
        deletionRequestedAt: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(user as any)

      const result = await service.getProfile('u1')
      expect('password' in result).toBe(false)
      expect(result.name).toBe('Test')
    })

    it('debería lanzar error si usuario no existe', async () => {
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(null)
      await expect(service.getProfile('u1')).rejects.toThrow(ProfileError)
    })
  })

  describe('updateProfile', () => {
    it('debería actualizar nombre y teléfono', async () => {
      const updated = { id: 'u1', name: 'New', phone: '+34612345678' }
      vi.mocked(mockPrismaUser.update).mockResolvedValue(updated as any)

      const result = await service.updateProfile('u1', { name: 'New', phone: '+34612345678' })
      expect(result.name).toBe('New')
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'New', phone: '+34612345678' },
      })
    })
  })

  describe('changePassword', () => {
    it('debería cambiar contraseña si la actual es correcta', async () => {
      const user = { id: 'u1', password: 'hashed' }
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(user as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(bcrypt.hash).mockResolvedValue('newhash' as never)
      vi.mocked(mockPrismaUser.update).mockResolvedValue({ ...user, password: 'newhash' } as any)

      await service.changePassword('u1', 'oldPass', 'newPass123')

      expect(bcrypt.compare).toHaveBeenCalledWith('oldPass', 'hashed')
      expect(bcrypt.hash).toHaveBeenCalledWith('newPass123', 12)
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { password: 'newhash' },
      })
    })

    it('debería lanzar error si el usuario no tiene contraseña (Google OAuth)', async () => {
      const user = { id: 'u1', password: null }
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(user as any)

      await expect(service.changePassword('u1', 'any', 'newPass123')).rejects.toThrow(ProfileError)
    })

    it('debería lanzar error si la contraseña actual es incorrecta', async () => {
      const user = { id: 'u1', password: 'hashed' }
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(user as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      await expect(service.changePassword('u1', 'wrong', 'newPass123')).rejects.toThrow(ProfileError)
    })
  })
})
