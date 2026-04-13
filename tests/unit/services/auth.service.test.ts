import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createUser, createUserWithNullOrg, createOrganization } from '../../factories/user.factory'

const mockPrismaUser = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}

const mockPrismaOrg = {
  create: vi.fn(),
  update: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: mockPrismaUser,
    organization: mockPrismaOrg,
  },
}))

vi.mock('@/services/email.service', () => ({
  emailService: {
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  },
}))

const { AuthService, AuthError } = await import('@/services/auth.service')

describe('AuthService', () => {
  let authService: InstanceType<typeof AuthService>

  beforeEach(() => {
    vi.clearAllMocks()
    authService = new AuthService()
  })

  describe('login', () => {
    it('debería retornar usuario y token con organizationId válido', async () => {
      const orgId = 'org-valid-123'
      const user = createUser({ organizationId: orgId, email: 'admin@test.com' })

      mockPrismaUser.findUnique.mockResolvedValue(user)

      const result = await authService.login('admin@test.com', 'password123')

      expect(result.user.organizationId).toBe(orgId)
      expect(result.token).toBeTruthy()
      expect(result.user.id).toBe(user.id)
      expect(result.user.email).toBe(user.email)
    })

    it('debería crear organización para usuario sin organizationId', async () => {
      const user = createUserWithNullOrg({ email: 'nullorg@test.com' })

      const newOrg = createOrganization({ ownerId: user.id, id: 'org-new-123', name: `${user.name}'s Fleet` })

      mockPrismaUser.findUnique.mockResolvedValue(user)
      mockPrismaOrg.create.mockResolvedValue(newOrg)
      mockPrismaUser.update.mockResolvedValue({ ...user, organizationId: newOrg.id })

      const result = await authService.login(user.email, 'password123')

      expect(mockPrismaOrg.create).toHaveBeenCalledWith({
        data: {
          name: `${user.name}'s Fleet`,
          ownerId: user.id,
        },
      })
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { organizationId: newOrg.id },
      })
      expect(result.user.organizationId).toBe(newOrg.id)
      expect(result.token).toBeTruthy()
    })

    it('debería lanzar error si el usuario no existe', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null)

      await expect(authService.login('noexiste@test.com', 'pass')).rejects.toThrow(AuthError)
    })

    it('debería lanzar error si la contraseña es incorrecta', async () => {
      const user = createUser({ organizationId: 'org-123', email: 'test@test.com' })
      mockPrismaUser.findUnique.mockResolvedValue(user)

      await expect(authService.login('test@test.com', 'wrongpassword')).rejects.toThrow(AuthError)
    })

    it('debería lanzar error si el usuario usa Google OAuth', async () => {
      const user = createUser({ organizationId: 'org-123' })
      user.password = null

      mockPrismaUser.findUnique.mockResolvedValue(user)

      await expect(authService.login(user.email, 'anypassword')).rejects.toThrow(AuthError)
    })

    it('debería usar el organizationId existente si ya existe', async () => {
      const orgId = 'org-existing-456'
      const user = createUser({ organizationId: orgId })

      mockPrismaUser.findUnique.mockResolvedValue(user)

      const result = await authService.login(user.email, 'password123')

      expect(mockPrismaOrg.create).not.toHaveBeenCalled()
      expect(result.user.organizationId).toBe(orgId)
    })
  })

  describe('register', () => {
    it('debería crear usuario con organización automáticamente', async () => {
      const newOrg = createOrganization({ ownerId: 'new-user-123', id: 'org-reg-123', name: "John's Fleet" })
      const newUser = createUser({ id: 'new-user-123', email: 'new@test.com', organizationId: newOrg.id, name: 'John' })

      mockPrismaUser.findUnique.mockResolvedValue(null)
      mockPrismaOrg.create.mockResolvedValue(newOrg)
      mockPrismaUser.create.mockResolvedValue(newUser)
      mockPrismaOrg.update.mockResolvedValue(newOrg)

      const result = await authService.register('John', 'new@test.com', 'password123')

      expect(mockPrismaOrg.create).toHaveBeenCalled()
      expect(result.user.organizationId).toBe(newOrg.id)
      expect(result.token).toBeTruthy()
    })
  })

  describe('verifyToken', () => {
    it('debería verificar un token válido con organizationId', async () => {
      const orgId = 'org-verify-123'
      const user = createUser({ organizationId: orgId })

      mockPrismaUser.findUnique.mockResolvedValue(user)

      const { token } = await authService.login(user.email, 'password123')
      const verified = await authService.verifyToken(token)

      expect(verified.userId).toBe(user.id)
      expect(verified.organizationId).toBe(orgId)
    })

    it('debería lanzar error con token inválido', async () => {
      await expect(authService.verifyToken('invalid-token')).rejects.toThrow(AuthError)
    })
  })

  describe('getSession', () => {
    it('debería retornar sesión con organizationId', async () => {
      const orgId = 'org-session-789'
      const user = createUser({ organizationId: orgId })

      mockPrismaUser.findUnique.mockResolvedValue(user)

      const { token } = await authService.login(user.email, 'password123')
      const session = await authService.getSession(token)

      expect(session?.user.organizationId).toBe(orgId)
      expect(session?.user.id).toBe(user.id)
    })

    it('debería retornar null para token inválido', async () => {
      const session = await authService.getSession('invalid-token')
      expect(session).toBeNull()
    })
  })
})
