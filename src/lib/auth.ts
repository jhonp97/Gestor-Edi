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
const prismaAdapter: any = PrismaAdapter(prisma)

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: prismaAdapter,
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
    async signIn({ user, account }) {
      if (account && user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { createdAt: true },
        })
        if (dbUser) {
          const isNewUser = Date.now() - dbUser.createdAt.getTime() < 60_000
          if (isNewUser) {
            emailService
              .sendWelcomeEmail(user.email, user.name || 'Usuario')
              .catch(console.error)
          }
        }
      }
      return true
    },
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
