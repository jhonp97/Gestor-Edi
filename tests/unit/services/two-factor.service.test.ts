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
  },
}))

vi.mock('twilio', () => ({
  default: class Twilio {
    verify = {
      v2: {
        services: () => ({
          verifications: {
            create: vi.fn(),
          },
          verificationChecks: {
            create: vi.fn(),
          },
        }),
      },
    }
  },
}))

import { TwoFactorService } from '@/services/two-factor.service'
import bcrypt from 'bcryptjs'
import { TwoFactorError } from '@/lib/errors'
import { prisma as mockPrisma } from '@/lib/prisma'

const mockPrismaUser = mockPrisma.user

describe('TwoFactorService', () => {
  let service: TwoFactorService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TwoFactorService()
  })

  describe('sendCode', () => {
    it('debería enviar código si el teléfono está verificado', async () => {
      const user = { id: 'u1', phone: '+34612345678', phoneVerified: new Date() }
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(user as any)
      const createMock = vi.fn().mockResolvedValue({ status: 'pending' })
      ;(service as any).verificationService = { verifications: { create: createMock }, verificationChecks: { create: vi.fn() } }

      const result = await service.sendCode('u1')
      expect(result.status).toBe('code_sent')
    })

    it('debería lanzar error si no hay teléfono verificado', async () => {
      const user = { id: 'u1', phone: null, phoneVerified: null }
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(user as any)

      await expect(service.sendCode('u1')).rejects.toThrow(TwoFactorError)
    })
  })

  describe('verifyCode', () => {
    it('debería habilitar 2FA si el código es correcto', async () => {
      const user = { id: 'u1', phone: '+34612345678', twoFactorEnabled: false }
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(user as any)
      const checkMock = vi.fn().mockResolvedValue({ status: 'approved' })
      const updateMock = vi.fn().mockResolvedValue({ ...user, twoFactorEnabled: true })
      vi.mocked(mockPrismaUser.update).mockImplementation(updateMock as any)
      ;(service as any).verificationService = { verifications: { create: vi.fn() }, verificationChecks: { create: checkMock } }

      const result = await service.verifyCode('u1', '123456')
      expect(result.enabled).toBe(true)
      expect(checkMock).toHaveBeenCalledWith({ to: '+34612345678', code: '123456' })
    })

    it('debería lanzar error si el código es incorrecto', async () => {
      const user = { id: 'u1', phone: '+34612345678', twoFactorEnabled: false }
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(user as any)
      const checkMock = vi.fn().mockResolvedValue({ status: 'pending' })
      ;(service as any).verificationService = { verifications: { create: vi.fn() }, verificationChecks: { create: checkMock } }

      await expect(service.verifyCode('u1', '000000')).rejects.toThrow(TwoFactorError)
    })
  })

  describe('disable', () => {
    it('debería deshabilitar 2FA con contraseña correcta', async () => {
      const user = { id: 'u1', password: 'hashed', twoFactorEnabled: true }
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(user as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(mockPrismaUser.update).mockResolvedValue({ ...user, twoFactorEnabled: false } as any)

      const result = await service.disable('u1', 'password123')
      expect(result.enabled).toBe(false)
    })

    it('debería lanzar error si la contraseña es incorrecta', async () => {
      const user = { id: 'u1', password: 'hashed', twoFactorEnabled: true }
      vi.mocked(mockPrismaUser.findUnique).mockResolvedValue(user as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      await expect(service.disable('u1', 'wrong')).rejects.toThrow(TwoFactorError)
    })
  })
})
