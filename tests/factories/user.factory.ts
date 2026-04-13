import type { User, Organization } from '@prisma/client'
import bcrypt from 'bcryptjs'

let userCounter = 0

export function createUser(overrides: Partial<User> & { organizationId: string }): User {
  userCounter++
  return {
    id: overrides.id ?? `user-${userCounter}`,
    name: overrides.name ?? `Test User ${userCounter}`,
    email: overrides.email ?? `user${userCounter}@test.com`,
    emailVerified: overrides.emailVerified ?? null,
    password: overrides.password ?? bcrypt.hashSync('password123', 10),
    role: overrides.role ?? 'USER',
    image: overrides.image ?? null,
    organizationId: overrides.organizationId,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    deletedAt: overrides.deletedAt ?? null,
    deletionRequestedAt: overrides.deletionRequestedAt ?? null,
  }
}

export function createUserWithNullOrg(overrides: Partial<User> = {}): User {
  return createUser({
    organizationId: null as unknown as string,
    ...overrides,
  })
}

export function createOrganization(overrides: Partial<Organization> & { ownerId: string }): Organization {
  return {
    id: overrides.id ?? 'org-test-id',
    name: overrides.name ?? 'Test Fleet',
    ownerId: overrides.ownerId,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}
