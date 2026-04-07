import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { UserRepository } from '@/repositories/user.repository'
import { PasswordResetTokenRepository } from '@/repositories/password-reset-token.repository'
import { emailService } from './email.service'
import type { AuthTokenPayload, AuthSession } from '@/types/auth'
import type { UserRole } from '@prisma/client'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_EXPIRY = '8h'
const BCRYPT_COST = 12
const RESET_TOKEN_EXPIRY_HOURS = 1

const userRepo = new UserRepository()
const tokenRepo = new PasswordResetTokenRepository()

export class AuthService {
  async register(name: string, email: string, password: string): Promise<{ user: AuthSession['user']; token: string }> {
    // Check if email already exists
    const existing = await userRepo.findByEmail(email)
    if (existing) {
      throw new AuthError('EMAIL_EXISTS', 'Este email ya está registrado')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST)

    // Create user
    const user = await userRepo.create({
      name,
      email,
      password: hashedPassword,
    })

    // Generate JWT
    const token = this.generateToken(user.id, user.email, user.role)

    // Send welcome email (async, don't block)
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
    // Find user
    const user = await userRepo.findByEmail(email)
    if (!user) {
      throw new AuthError('INVALID_CREDENTIALS', 'Email o contraseña incorrectos')
    }

    // OAuth users don't have password
    if (!user.password) {
      throw new AuthError('INVALID_CREDENTIALS', 'Este email está registrado con Google. Iniciá sesión con Google.')
    }

    // Verify password - ensure it's a valid bcrypt hash
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw new AuthError('INVALID_CREDENTIALS', 'Email o contraseña incorrectos')
    }

    // Generate JWT
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
    // Always return success to prevent email enumeration
    const user = await userRepo.findByEmail(email)
    if (!user) return

    // Delete any existing tokens for this user
    await tokenRepo.deleteByUserId(user.id)

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

    // Save token
    await tokenRepo.create(user.id, token, expiresAt)

    // Send reset email
    await emailService.sendPasswordResetEmail(email, user.name, token)
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Find token
    const resetToken = await tokenRepo.findByToken(token)
    if (!resetToken) {
      throw new AuthError('INVALID_TOKEN', 'Token inválido o expirado')
    }

    // Check if expired
    if (resetToken.expiresAt < new Date()) {
      throw new AuthError('TOKEN_EXPIRED', 'El token ha expirado')
    }

    // Check if already used
    if (resetToken.used) {
      throw new AuthError('TOKEN_USED', 'Este token ya fue utilizado')
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST)

    // Update password
    await userRepo.updatePassword(resetToken.userId, hashedPassword)

    // Mark token as used
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
