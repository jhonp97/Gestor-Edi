import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import type { UserRole } from '@prisma/client'

// Cast to avoid version mismatch between next-auth and prisma-adapter
const prismaAdapter = PrismaAdapter(prisma) as any

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: prismaAdapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Add user ID and role to token on first sign in
      if (account && user) {
        token.id = user.id
        token.role = (user as any).role || 'USER'
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
