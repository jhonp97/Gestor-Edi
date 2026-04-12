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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter: any = {
  ...originalAdapter,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createUser(user: any) {
    const created = await originalAdapter.createUser!(user)

    // Create organization for the new user
    const org = await prisma.organization.create({
      data: {
        name: `${created.name || 'Usuario'}'s Fleet`,
        ownerId: created.id,
      },
    })

    // Link user to organization
    await prisma.user.update({
      where: { id: created.id },
      data: { organizationId: org.id },
    })

    created.organizationId = org.id

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
        // organizationId may come from createUser override (set on created object)
        token.organizationId = (user as UserWithRole & { organizationId?: string }).organizationId
      }
      return token
    },
    async session({ session, token }) {
      // Add user ID and role to session
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = (token.role as UserRole) || 'USER'
        session.user.organizationId = token.organizationId as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
