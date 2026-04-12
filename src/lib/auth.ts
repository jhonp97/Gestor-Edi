import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { emailService } from '@/services/email.service'
import type { UserRole } from '@prisma/client'

// Extended user type for role access
interface UserWithRole {
  id: string
  role?: UserRole
  email?: string | null
  name?: string | null
  image?: string | null
}

// Use type assertion to avoid type issues with prisma adapter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalAdapter: any = PrismaAdapter(prisma)

const adapter = {
  ...originalAdapter,
  async createUser(user: any) {
    const created = await originalAdapter.createUser!(user)
    if (created.email) {
      emailService
        .sendWelcomeEmail(created.email, created.name || 'Usuario')
        .catch(console.error)
    }
    return created
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
  callbacks: {
    async jwt({ token, user, account }) {
      // Add user ID and role to token on first sign in
      if (account && user) {
        token.id = user.id
        token.role = (user as UserWithRole).role || 'USER'
      }
      return token
    },
    async session({ session, token }) {
      // Add user ID and role to session
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = (token.role as UserRole) || 'USER'
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
