import type { User, PasswordResetToken, UserRole } from '@prisma/client'

export type { User, PasswordResetToken, UserRole }

export interface AuthTokenPayload {
  userId: string
  email: string
  role: UserRole
}

export interface AuthSession {
  user: {
    id: string
    name: string
    email: string
    role: UserRole
  }
}

export type CreateUserInput = {
  name: string
  email: string
  password: string
  role?: UserRole
}

export type LoginInput = {
  email: string
  password: string
}

export type ForgotPasswordInput = {
  email: string
}

export type ResetPasswordInput = {
  token: string
  password: string
}

export type ChangeRoleInput = {
  role: UserRole
}
