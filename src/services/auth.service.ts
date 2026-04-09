import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { UserRepository } from '@/repositories/user.repository'
import { PasswordResetTokenRepository } from '@/repositories/password-reset-token.repository'
import { emailService } from './email.service'
import type { AuthTokenPayload, AuthSession } from '@/types/auth'
import type { UserRole } from '@prisma/client'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production'
const JWT_EXPIRY = '8h'
const BCRYPT_COST = 12
const RESET_TOKEN_EXPIRY_HOURS = 1

const userRepo = new UserRepository()
const tokenRepo = new PasswordResetTokenRepository()

export class AuthService {
  async register(name: string, email: string, password: string): Promise<{ user: AuthSession['user']; token: string }> {
    const existing = await userRepo.findByEmail(email)
    if (existing) {
      throw new AuthError('EMAIL_EXISTS', 'Este email ya está registrado')
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST)

    const user = await userRepo.create({
      name,
      email,
      password: hashedPassword,
    })

    const token = this.generateToken(user.id, user.email, user.role)

    emailService.sendWelcomeEmail(email, name).catch(console.error)

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    }
  }

  async login(email: string, password: string): Promise<{ user: AuthSession['user']; token: string }> {
    const user = await userRepo.findByEmail(email)
    if (!user) {
      throw new AuthError('EMAIL_NOT_FOUND', 'No existe ninguna cuenta con este email')
    }

    if (!user.password) {
      throw new AuthError('EMAIL_NOT_FOUND', 'Este email está registrado con Google. Iniciá sesión con Google.')
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw new AuthError('WRONG_PASSWORD', 'La contraseña es incorrecta')
    }

    const token = this.generateToken(user.id, user.email, user.role)

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    }
  }

  async verifyToken(token: string): Promise<AuthTokenPayload> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload
      return payload
    } catch {
      throw new AuthError('INVALID_TOKEN', 'Token inválido o expirado')
    }
  }

  async getSession(token: string): Promise<AuthSession | null> {
    try {
      const payload = await this.verifyToken(token)
      const user = await userRepo.findById(payload.userId)
      if (!user) return null

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      }
    } catch {
      return null
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await userRepo.findByEmail(email)
    if (!user) return

    await tokenRepo.deleteByUserId(user.id)

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

    await tokenRepo.create(user.id, token, expiresAt)
    await emailService.sendPasswordResetEmail(email, user.name, token)
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await tokenRepo.findByToken(token)
    if (!resetToken) {
      throw new AuthError('INVALID_TOKEN', 'Token inválido o expirado')
    }

    if (resetToken.expiresAt < new Date()) {
      throw new AuthError('TOKEN_EXPIRED', 'El token ha expirado')
    }

    if (resetToken.used) {
      throw new AuthError('TOKEN_USED', 'Este token ya fue utilizado')
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST)
    await userRepo.updatePassword(resetToken.userId, hashedPassword)
    await tokenRepo.markAsUsed(resetToken.id)
  }

  async getAllUsers() {
    return userRepo.findAll()
  }

  async deleteUser(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new AuthError('CANNOT_DELETE_SELF', 'No podés eliminar tu propia cuenta')
    }
    await userRepo.delete(id)
  }

  async changeUserRole(id: string, role: UserRole): Promise<void> {
    await userRepo.updateRole(id, role)
  }

  private generateToken(userId: string, email: string, role: UserRole): string {
    // DEBUG — eliminar tras confirmar el problema
    console.log('[auth.service] NEXTAUTH_SECRET definido:', !!process.env.NEXTAUTH_SECRET)
    console.log('[auth.service] JWT_SECRET primeros 6 chars:', JWT_SECRET.substring(0, 6))

    const payload: AuthTokenPayload = { userId, email, role }
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
  }
}

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export const authService = new AuthService()