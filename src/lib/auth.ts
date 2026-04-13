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
  organizationId?: string
}

// Use type assertion to avoid type issues with prisma adapter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalAdapter: any = PrismaAdapter(prisma)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter: any = {
  ...originalAdapter,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createUser(user: any) {
    // Create organization first
    const org = await prisma.organization.create({
      data: {
        name: `${user.name || 'Usuario'}'s Fleet`,
        ownerId: 'temp',
      },
    })

    // Create user with organizationId
    const created = await prisma.user.create({
      data: {
        name: user.name || '',
        email: user.email,
        image: user.image,
        organizationId: org.id,
      },
    })

    // Update org with correct ownerId
    await prisma.organization.update({
      where: { id: org.id },
      data: { ownerId: created.id },
    })

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
      if (account && user) {
        token.id = user.id
        token.role = (user as UserWithRole).role || 'USER'
        if ((user as UserWithRole).organizationId) {
          token.organizationId = (user as UserWithRole).organizationId
        }
      }
      // On subsequent logins, fetch organizationId from DB if missing
      if (!token.organizationId && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { organizationId: true },
        })
        if (dbUser?.organizationId) {
          token.organizationId = dbUser.organizationId
        } else if (dbUser) {
          // User has no org — create one now
          const org = await prisma.organization.create({
            data: {
              name: `${token.name || 'Usuario'}'s Fleet`,
              ownerId: token.id as string,
            },
          })
          await prisma.user.update({
            where: { id: token.id as string },
            data: { organizationId: org.id },
          })
          token.organizationId = org.id
        }
      }
      return token
    },
    async session({ session, token }) {
      // Add user ID and role to session
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = (token.role as UserRole) || 'USER'
        session.user.organizationId = token.organizationId as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
