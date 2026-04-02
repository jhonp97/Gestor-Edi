# Tasks: Auth Module Implementation

## Phase 1: Foundation (DB, types, schemas, repositories)

- [ ] 1.1 Create src/types/auth.ts with UserRole enum and AuthToken interface
- [ ] 1.2 Create src/schemas/auth.schema.ts with Zod schemas for register, login, forgot password, reset password
- [ ] 1.3 Update prisma/schema.prisma to add User model with role field and PasswordResetToken model
- [ ] 1.4 Create src/repositories/user.repository.ts with CRUD operations for User
- [ ] 1.5 Create src/repositories/password-reset-token.repository.ts with CRUD operations for PasswordResetToken
- [ ] 1.6 Update prisma/seed.ts to create initial admin user

## Phase 2: Services (auth logic, email service)

- [ ] 2.1 Create src/services/email.service.ts with Resend integration for sending emails
- [ ] 2.2 Create src/services/auth.service.ts with register, login, logout, password reset methods
- [ ] 2.3 Implement bcrypt password hashing (cost 12) in auth.service.ts
- [ ] 2.4 Implement JWT generation (HS256, 8-hour expiry) in auth.service.ts
- [ ] 2.5 Implement token validation and verification in auth.service.ts

## Phase 3: API Routes (endpoints)

- [ ] 3.1 Create app/api/auth/register/route.ts with user registration endpoint
- [ ] 3.2 Create app/api/auth/login/route.ts with user login endpoint
- [ ] 3.3 Create app/api/auth/logout/route.ts with user logout endpoint
- [ ] 3.4 Create app/api/auth/forgot-password/route.ts with password reset request endpoint
- [ ] 3.5 Create app/api/auth/reset-password/route.ts with password reset execution endpoint
- [ ] 3.6 Create app/api/auth/session/route.ts to get current user session
- [ ] 3.7 Create app/api/admin/users/route.ts to list all users (admin only)
- [ ] 3.8 Create app/api/admin/users/[id]/route.ts to delete user and change role (admin only)

## Phase 4: Pages (UI)

- [ ] 4.1 Create app/login/page.tsx with login form
- [ ] 4.2 Create app/register/page.tsx with registration form
- [ ] 4.3 Create app/forgot-password/page.tsx with password reset request form
- [ ] 4.4 Create app/reset-password/page.tsx with password reset form
- [ ] 4.5 Create app/admin/users/page.tsx with admin user management interface

## Phase 5: Integration (middleware, landing page, header)

- [ ] 5.1 Update src/middleware.ts to verify JWT and check role for admin routes
- [ ] 5.2 Update src/app/page.tsx (landing page) to show auth buttons and redirect authenticated users
- [ ] 5.3 Update components/layout/header.tsx to show user greeting when authenticated
- [ ] 5.4 Update components/layout/sidebar.tsx to add logout button
- [ ] 5.5 Update .env.example with JWT_SECRET, RESEND_API_KEY, and ADMIN variables

## Phase 6: Admin (admin panel)

- [ ] 6.1 Implement admin-only access control in admin API routes
- [ ] 6.2 Implement user deletion with confirmation in admin UI
- [ ] 6.3 Implement role changing functionality in admin UI
- [ ] 6.4 Prevent admin from deleting their own account

## Phase 7: Testing (unit, integration, E2E)

- [ ] 7.1 Write unit tests for auth.service.ts
- [ ] 7.2 Write unit tests for email.service.ts
- [ ] 7.3 Write unit tests for user.repository.ts
- [ ] 7.4 Write unit tests for password-reset-token.repository.ts
- [ ] 7.5 Write integration tests for auth API routes
- [ ] 7.6 Write E2E tests for user registration flow
- [ ] 7.7 Write E2E tests for login/logout flow
- [ ] 7.8 Write E2E tests for password reset flow
- [ ] 7.9 Write E2E tests for admin user management
- [ ] 7.10 Verify all acceptance criteria from spec are met