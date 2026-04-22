import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { UserProfileRepository } from '@/repositories/user-profile.repository'
const { prisma: mockPrisma } = await import('@/lib/prisma')

describe('UserProfileRepository', () => {
  let repo: UserProfileRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new UserProfileRepository()
  })

  it('debería encontrar usuario por id', async () => {
    const user = {
      id: 'user-1',
      name: 'Test',
      email: 'test@test.com',
      phone: '+34612345678',
      image: null,
      role: 'USER',
      organizationId: 'org-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      deletionRequestedAt: null,
      emailVerified: null,
      password: 'hashed',
      phoneVerified: null,
      twoFactorEnabled: false,
      twoFactorMethod: 'NONE',
      language: 'es',
      notificationsEnabled: true,
      emailNotifications: true,
      smsNotifications: false,
      gdprConsentGiven: false,
      gdprConsentDate: null,
    }
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(user as any)

    const result = await repo.findById('user-1')
    expect(result).toEqual(user)
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } })
  })

  it('debería actualizar perfil', async () => {
    const updated = { id: 'user-1', name: 'Updated' } as any
    vi.mocked(mockPrisma.user.update).mockResolvedValue(updated)

    const result = await repo.updateProfile('user-1', { name: 'Updated' })
    expect(result.name).toBe('Updated')
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Updated' },
    })
  })

  it('debería actualizar teléfono', async () => {
    const updated = { id: 'user-1', phone: '+34612345678' } as any
    vi.mocked(mockPrisma.user.update).mockResolvedValue(updated)

    const result = await repo.updatePhone('user-1', '+34612345678')
    expect(result.phone).toBe('+34612345678')
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { phone: '+34612345678' },
    })
  })

  it('debería actualizar contraseña', async () => {
    const updated = { id: 'user-1', password: 'newhash' } as any
    vi.mocked(mockPrisma.user.update).mockResolvedValue(updated)

    const result = await repo.updatePassword('user-1', 'newhash')
    expect(result.password).toBe('newhash')
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { password: 'newhash' },
    })
  })

  it('debería actualizar preferencias', async () => {
    const updated = { id: 'user-1', language: 'en' } as any
    vi.mocked(mockPrisma.user.update).mockResolvedValue(updated)

    const result = await repo.updatePreferences('user-1', { language: 'en' })
    expect(result.language).toBe('en')
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { language: 'en' },
    })
  })
})
