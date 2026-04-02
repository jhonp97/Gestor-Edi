# Auth Module Specification

## Purpose

Secure user authentication for the flota-camiones-pwa fleet management application. Currently zero auth exists — all routes publicly accessible. This spec defines user registration, login, logout, password reset, admin panel, and route protection.

## Requirements

### R1: User Registration

The system SHALL allow new users to register with name, email, and password. Password confirmation MUST match. Passwords MUST be at least 8 characters, hashed with bcrypt cost 12. Email MUST be unique. On success, the user is auto-logged in and receives a welcome email via Resend.

#### Scenario: Successful registration

- GIVEN a visitor at /register with valid name, email, password, and matching confirmPassword
- WHEN they submit the form
- THEN a User record is created with bcrypt-hashed password
- AND a JWT cookie is set (HttpOnly, Secure, SameSite=Lax)
- AND a welcome email is sent to the registered email
- AND the user is redirected to /dashboard

#### Scenario: Duplicate email registration

- GIVEN a user already exists with email "user@test.com"
- WHEN a visitor tries to register with the same email
- THEN the system returns a validation error "Email already registered"
- AND no account is created

#### Scenario: Password mismatch

- GIVEN a visitor fills the form with password "abc12345" and confirmPassword "different"
- WHEN they submit
- THEN the system returns validation error "Passwords do not match"

### R2: User Login

The system SHALL allow registered users to authenticate with email + password. Credentials MUST be verified against the bcrypt hash. On success, a JWT (HS256, 8-hour expiry) is issued in an HttpOnly cookie.

#### Scenario: Successful login

- GIVEN a registered user with email "user@test.com"
- WHEN they submit correct email and password at /login
- THEN a JWT cookie is set with HttpOnly + Secure + SameSite=Lax
- AND the user is redirected to /dashboard

#### Scenario: Invalid credentials

- GIVEN a registered user with email "user@test.com"
- WHEN they submit wrong password
- THEN the system returns "Invalid email or password"
- AND no cookie is set

#### Scenario: Non-existent email

- GIVEN no user exists with email "nobody@test.com"
- WHEN they attempt login
- THEN the system returns "Invalid email or password"
- AND no cookie is set

### R3: User Logout

The system SHALL allow authenticated users to log out. The JWT cookie MUST be cleared. The user SHALL be redirected to /login.

#### Scenario: Logout

- GIVEN an authenticated user
- WHEN they click logout
- THEN the JWT cookie is deleted
- AND the user is redirected to /login

### R4: Password Reset Request

The system SHALL allow users to request a password reset. A unique token (crypto.randomBytes) SHALL be generated, stored in PasswordResetToken table, expiring in 1 hour. An email with reset link (/reset-password?token=xxx) SHALL be sent via Resend.

#### Scenario: Reset request with valid email

- GIVEN a registered user at /forgot-password
- WHEN they submit their email
- THEN a PasswordResetToken is created (expires in 1 hour)
- AND an email with reset link is sent

#### Scenario: Reset request with unknown email

- GIVEN no user with email "unknown@test.com"
- WHEN they request a reset
- THEN the system shows a generic success message (does NOT reveal if email exists)

### R5: Password Reset Execution

The system SHALL allow password reset via a valid, unexpired, unused token. The token SHALL be validated (exists, not expired, not used). On success, the password is updated and the token is marked as used.

#### Scenario: Valid reset token

- GIVEN a user has a valid reset token
- WHEN they visit /reset-password?token=xxx and submit a new password
- THEN the password is updated (bcrypt hashed)
- AND the token is marked used
- AND the user is redirected to /login with success message

#### Scenario: Expired reset token

- GIVEN a user has a reset token older than 1 hour
- WHEN they try to use it
- THEN the system shows "Token expired or invalid"

#### Scenario: Already-used reset token

- GIVEN a reset token was already used
- WHEN the user tries to use it again
- THEN the system shows "Token expired or invalid"

### R6: Admin User Management

The system SHALL provide an admin panel at /admin/users accessible only to ADMIN role users. Admins can view, delete (with confirmation), and change user roles. Admins MUST NOT be able to delete their own account.

#### Scenario: Admin views user list

- GIVEN an admin user at /admin/users
- WHEN the page loads
- THEN a table shows all users: name, email, role, createdAt

#### Scenario: Admin deletes a user

- GIVEN an admin viewing user list
- WHEN they click delete on another user and confirm
- THEN the user record is removed from the database

#### Scenario: Admin cannot delete self

- GIVEN an admin viewing user list
- WHEN they try to delete their own account
- THEN the delete action is prevented with an error message

#### Scenario: Non-admin cannot access admin panel

- GIVEN a regular USER at /admin/users
- WHEN the page loads
- THEN the system redirects to /dashboard with "Access denied"

### R7: Landing Page

The system SHALL present a public landing page at / with app description, features, and "Iniciar Sesion" / "Crear Cuenta" buttons. If the user is already authenticated, they SHALL be redirected to /dashboard.

#### Scenario: Guest visits landing page

- GIVEN a non-authenticated visitor at /
- WHEN the page loads
- THEN the landing page displays with app info and auth buttons

#### Scenario: Authenticated user visits landing page

- GIVEN an authenticated user at /
- WHEN the page loads
- THEN the user is redirected to /dashboard

### R8: Protected Route Access

The system SHALL protect /dashboard, /trucks, /transactions, /workers, /nomina, and /admin/* routes. Unauthenticated users SHALL be redirected to /login. /admin/* requires ADMIN role.

#### Scenario: Unauthenticated user accesses dashboard

- GIVEN a visitor without a valid JWT cookie
- WHEN they navigate to /dashboard
- THEN they are redirected to /login

#### Scenario: Authenticated user accesses dashboard

- GIVEN a user with a valid JWT cookie
- WHEN they navigate to /dashboard
- THEN the page loads normally

### R9: Public Routes

The following routes SHALL remain accessible without authentication: /, /login, /register, /forgot-password, /reset-password, /offline, /api/health.

#### Scenario: Guest accesses login page

- GIVEN a visitor without authentication
- WHEN they navigate to /login
- THEN the login page loads normally

## Acceptance Criteria

1. [ ] User can register with name, email, password, confirmPassword
2. [ ] User can login with email + password
3. [ ] User can logout (cookie cleared, redirected to /login)
4. [ ] User can request password reset at /forgot-password
5. [ ] User can reset password with valid token at /reset-password
6. [ ] Admin can view all users at /admin/users
7. [ ] Admin can delete users (not self) with confirmation
8. [ ] Admin can change user roles
8. [ ] Landing page shows at / with auth buttons
9. [ ] Authenticated users on / redirect to /dashboard
10. [ ] Unauthenticated users on protected routes redirect to /login
11. [ ] JWT cookie is HttpOnly + Secure + SameSite=Lax
12. [ ] Passwords stored as bcrypt hashes (cost 12)
13. [ ] Rate limiting: 100/hour public, 500/hour authenticated
14. [ ] Password validation: min 8 chars, confirm matches
15. [ ] Welcome email sent on registration
16. [ ] Password reset email sent with token link
17. [ ] Reset tokens expire in 1 hour, single use
18. [ ] All existing routes still work for authenticated users
19. [ ] Input validated with Zod schemas
20. [ ] Tests pass: unit, integration, E2E
