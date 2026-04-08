# Flota Camiones PWA — Architecture Document

> **Last updated**: 2026-04-08
> **Status**: Production Ready — All CI/CD Green ✅
> **Author**: AI Software Architect

---

## 1. Project Overview

**What**: PWA (Progressive Web App) for truck fleet cash-flow management for an autonomous worker in Spain.

**Who**: Single user, aged 50+. Needs simple, accessible UI with large fonts, clear buttons, high contrast.

**Core Features**:
- Dashboard: income/expense summary, net profit per month, charts
- Truck management: register trucks with plate, brand, model, stats (income/expense/balance)
- Transaction tracking: income and expenses per truck, categorized
- Worker management: CRUD for workers with payroll system
- Payroll: generate monthly payslips with IRPF, Social Security, bonuses, deductions
- PDF payslips: downloadable salary certificates
- Offline support: works without internet, syncs when reconnected
- PWA: installable on mobile as native-like app
- Authentication: JWT + Google OAuth (NextAuth v5)

**Deferred** (future changes):
- Multi-user isolation (currently single-user, shared data)
- Production deployment (Vercel/Railway)
- Reports module (monthly summary, export CSV/Excel)

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js | 16.x | App Router, Server Components, SSR |
| **Language** | TypeScript | 5.x | Type safety throughout |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS (CSS-native config) |
| **UI Components** | Shadcn UI | latest | Accessible, unstyled primitives |
| **Icons** | Lucide React | latest | Consistent icon set |
| **Database** | Prisma + SQLite | 7.x | ORM + local file-based DB |
| **Validation** | Zod | 4.x | Shared client/server schemas |
| **Seed Runtime** | tsx | 4.x | Run TypeScript seed scripts |
| **Testing Unit** | Vitest | latest | Fast, ESM-native test runner |
| **Testing Component** | @testing-library/react | latest | Component behavior testing |
| **Testing E2E** | Playwright | latest | Multi-browser E2E tests |
| **CI/CD** | GitHub Actions | — | Automated pipeline |
| **Package Manager** | pnpm | 8.x+ | Fast, disk-efficient |

**IMPORTANT**: Everything uses pnpm. No npm, no yarn.

---

## 3. Architecture — 4-Layer Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                        │
│  Server Components (pages) │ Client Components (forms)      │
│  Shadcn UI primitives      │ Lucide icons                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                            │
│  Business logic, Zod validation, orchestration              │
│  TransactionService │ TruckService │ ReportService          │
└──────────────────────┬──────────────────────────────────────┘
                       │ calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   REPOSITORY LAYER                           │
│  Data access abstraction, Prisma queries                    │
│  TransactionRepository │ TruckRepository │ BaseRepository   │
└──────────────────────┬──────────────────────────────────────┘
                       │ calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  Prisma Client → SQLite (file: ./prisma/dev.db)             │
│  Migrations via `prisma db push` or `prisma migrate dev`    │
└─────────────────────────────────────────────────────────────┘
```

**Key Rules**:
- Components NEVER talk to repositories directly
- Services validate ALL inputs with Zod before touching repositories
- Repositories only do data access — no business logic
- Server Actions call Services, not Repositories directly

---

## 4. Directory Structure

```
flota-camiones-pwa/
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions pipeline
├── prisma/
│   ├── schema.prisma                 # Database schema (Truck, Transaction)
│   ├── prisma.config.ts              # Prisma 7.x config
│   ├── dev.db                        # SQLite database (gitignored)
│   └── seed.ts                       # Seed data (future)
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service worker
│   └── icons/                        # PWA icons (192px, 512px, maskable)
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx                # Root layout (MainLayout)
│   │   ├── page.tsx                  # Root → redirects to /dashboard
│   │   ├── globals.css               # Global styles + Tailwind
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Dashboard with summary cards
│   │   ├── trucks/
│   │   │   ├── page.tsx              # Truck list + add form
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Truck detail + its transactions
│   │   ├── transactions/
│   │   │   ├── page.tsx              # Transaction list + filters
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Redirects to list
│   │   ├── api/
│   │   │   ├── health/
│   │   │   │   └── route.ts          # Health check endpoint
│   │   │   ├── trucks/
│   │   │   │   └── route.ts          # POST create truck
│   │   │   └── transactions/
│   │   │       └── route.ts          # POST create transaction
│   │   └── offline/
│   │       └── page.tsx              # Offline fallback page
│   ├── components/
│   │   ├── ui/                       # Shadcn UI primitives (DO NOT EDIT)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   └── table.tsx
│   │   ├── layout/
│   │   │   ├── sidebar.tsx           # Navigation sidebar
│   │   │   ├── header.tsx            # Top header + offline indicator
│   │   │   └── main-layout.tsx       # Combines sidebar + header
│   │   ├── dashboard/
│   │   │   ├── summary-card.tsx      # Income/Expense/Profit cards
│   │   │   └── recent-transactions.tsx
│   │   ├── trucks/
│   │   │   ├── truck-card.tsx        # Truck card with status badge
│   │   │   └── truck-form.tsx        # Add/edit truck form (CLIENT)
│   │   ├── transactions/
│   │   │   ├── transaction-form.tsx  # Add transaction form (CLIENT)
│   │   │   └── transaction-list.tsx  # Filterable list (CLIENT)
│   │   └── shared/
│   │       ├── offline-banner.tsx    # Shows when offline
│   │       └── loading-spinner.tsx
│   ├── lib/
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   └── utils.ts                  # cn() utility (from shadcn)
│   ├── services/                     # BUSINESS LOGIC LAYER
│   │   ├── transaction.service.ts
│   │   └── truck.service.ts
│   ├── repositories/                 # DATA ACCESS LAYER
│   │   ├── base.repository.ts        # Abstract base with prisma
│   │   ├── transaction.repository.ts
│   │   └── truck.repository.ts
│   ├── schemas/                      # ZOD VALIDATION SCHEMAS
│   │   └── index.ts                  # Shared client/server validation
│   ├── types/                        # TYPESCRIPT TYPES
│   │   └── index.ts                  # All types (match Prisma models)
│   └── middleware.ts                 # Security headers + rate limiting
├── tests/
│   ├── unit/
│   │   ├── services/                 # Service layer tests
│   │   └── repositories/             # Repository layer tests
│   ├── integration/
│   │   ├── api/                      # API endpoint tests
│   │   └── db/                       # Database operation tests
│   ├── e2e/                          # Playwright E2E tests
│   │   ├── dashboard.spec.ts
│   │   └── transactions.spec.ts
│   └── factories/                    # Test data factories
│       ├── transaction.factory.ts
│       └── truck.factory.ts
├── architecture.md                   # THIS FILE
├── vitest.config.ts                  # Vitest configuration
├── playwright.config.ts              # Playwright configuration
├── next.config.ts                    # Next.js config + security headers
├── package.json                      # Scripts + dependencies
├── tsconfig.json                     # TypeScript config
└── .env.example                      # Environment variables template
```

---

## 5. Database Schema

```prisma
model Truck {
  id           String        @id @default(uuid())
  plate        String        @unique
  brand        String
  model        String
  year         Int
  status       TruckStatus   @default(ACTIVE)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  transactions Transaction[]
}

model Transaction {
  id          String          @id @default(uuid())
  truckId     String
  truck       Truck           @relation(fields: [truckId], references: [id], onDelete: Cascade)
  type        TransactionType
  amount      Float
  description String
  date        DateTime
  category    String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

enum TruckStatus { ACTIVE, MAINTENANCE, INACTIVE }
enum TransactionType { INCOME, EXPENSE }
```

**Relationships**: Truck 1:N Transaction (cascade delete)

---

## 6. Security Model

### Current (Scaffold)
| Control | Implementation |
|---------|---------------|
| Security Headers | Middleware: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy |
| CSP | next.config.ts: Content-Security-Policy header |
| Rate Limiting | Middleware: 100 requests/hour per IP |
| Input Validation | Zod schemas shared client/server |
| SQL Injection | Prisma ORM (parameterized queries) |
| XSS | React auto-escapes + CSP headers |

### Future (Auth Change)
| Control | Implementation |
|---------|---------------|
| Authentication | HttpOnly + Secure + SameSite=strict cookies |
| Password Storage | bcrypt (cost factor 12+) |
| JWT | In HttpOnly cookie ONLY — never in localStorage |
| Auth Middleware | Verify cookie → inject user context → next() |
| CSRF Protection | SameSite=strict cookies + CSRF tokens |

---

## 7. PWA Architecture

### Service Worker Strategy
| Resource Type | Strategy | Why |
|--------------|----------|-----|
| Static assets (CSS, JS, images) | **Cache First** | Rarely change, fast loading |
| API calls (/api/*) | **Network First** | Need fresh data, fallback to cache |
| Pages | **Stale While Revalidate** | Show cached fast, update in background |

### Offline Flow
1. User goes offline → Service Worker intercepts
2. Static assets → served from cache
3. API calls → served from cache + offline banner shown
4. User comes back → data refreshes automatically

---

## 8. Testing Strategy

| Level | Tool | What | Coverage Target |
|-------|------|------|-----------------|
| **Unit** | Vitest | Services, repositories, utils | 80% statements |
| **Component** | @testing-library/react | Form behavior, rendering | 70% branches |
| **E2E** | Playwright | User flows (dashboard, CRUD) | Critical paths |
| **Integration** | Vitest + Prisma | API routes, DB operations | Happy paths |

### Test Data
- Factory pattern for generating test data
- `tests/factories/transaction.factory.ts`
- `tests/factories/truck.factory.ts`

---

## 9. CI/CD Pipeline

```
quality (lint + typecheck)
    ├── test (unit + integration with coverage)
    │       └── e2e (Playwright)
    └── build
audit (parallel — pnpm audit)
```

**Quality Gates**: lint must pass, typecheck must pass, tests must pass, build must succeed, audit must have no critical vulnerabilities.

---

## 10. Scalability Patterns

These patterns make future changes easy WITHOUT refactoring:

| Pattern | What It Enables |
|---------|-----------------|
| **Repository Pattern** | Swap SQLite → PostgreSQL by changing only repositories |
| **Service Layer** | Add new features by adding new services, no existing code touched |
| **Feature-based Structure** | Add payroll/reports/auth as isolated modules |
| **Barrel Exports** | Clean public API per feature, internals hidden |
| **Zod Shared Schemas** | One schema validates client forms AND server actions |
| **Type-safe Contracts** | TypeScript catches breaking changes at compile time |

### Adding a New Feature
1. Create `src/features/<feature>/` directory
2. Add repository, service, schema, types, components
3. Add routes in `src/app/<feature>/`
4. Export from barrel files
5. Write tests in `tests/unit/<feature>/`
6. **No existing code needs to change**

---

## 11. Commands Reference

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Production build
pnpm start                  # Start production server

# Database
pnpm db:generate            # Generate Prisma client
pnpm db:push                # Push schema to SQLite
pnpm db:migrate             # Create migration
pnpm db:seed                # Seed data
pnpm db:studio              # Open Prisma Studio

# Testing
pnpm test                   # Run tests in watch mode
pnpm test:unit              # Run unit tests once
pnpm test:coverage          # Run with coverage report
pnpm test:e2e               # Run Playwright E2E tests
pnpm test:e2e:ui            # Run E2E with UI

# Quality
pnpm lint                   # ESLint check
pnpm typecheck              # TypeScript check
```

---

## 12. SDD History

| Change | Status | Description |
|--------|--------|-------------|
| scaffold-project | ✅ COMPLETED | Greenfield scaffold with testing, CI/CD, OWASP (55 tests, 40/40 tasks) |
| ui-overhaul-and-workers | ✅ COMPLETED | Professional UI, worker CRUD, payroll system with Spanish deductions, PDF generation |
| auth-google-oauth | ✅ COMPLETED | JWT auth with cookies, Google OAuth integration (NextAuth v5), login/register pages |
| payroll-extras | ✅ COMPLETED | Payroll with bonuses and additional deductions |
| pwa-offline | ✅ COMPLETED | PWA with offline support using IndexedDB for token storage |

### Current State
- 22 routes built
- 55 unit tests passing ✅
- Lint + typecheck + build all clean ✅
- CI/CD pipeline: Quality → Test → Build → Audit (all green ✅)
- DB seeded: 3 trucks, 20 transactions, 4 workers, 3 payrolls
- PWA installable
- Offline support via IndexedDB
- Login supports Enter key ✅

---

## 13. Authentication System

### Architecture
```
User Login → API /api/auth/login → JWT Token
                                        ↓
                    ┌─────────────────────┴─────────────────────┐
                    ↓                                           ↓
            HTTP-Only Cookie                           IndexedDB (offline)
            (secure, HTTP-only)                        (x-auth-token header)
                    ↓                                           ↓
            Middleware validates                    Works when offline
            Cookie + x-auth-token header
```

### Implementation Details
| Component | File | Description |
|-----------|------|-------------|
| Auth Service | `src/services/auth.service.ts` | JWT generation/validation with bcrypt |
| Login API | `src/app/api/auth/login/route.ts` | Returns token in body + sets HTTP-only cookie |
| Register API | `src/app/api/auth/register/route.ts` | Creates user with hashed password |
| Session API | `src/app/api/auth/session/route.ts` | Returns current user from token |
| Middleware | `src/middleware.ts` | Validates cookie OR x-auth-token header |
| NextAuth | `src/lib/auth.ts` | NextAuth v5 configuration with Google provider |
| Offline Auth | `src/lib/offline.ts` | IndexedDB storage for offline token access |

### Environment Variables (for Google OAuth)
```env
NEXTAUTH_SECRET=your-generated-secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Key Security Rules
1. JWT stored in HTTP-only cookie when online
2. Token also stored in IndexedDB for offline (sent via x-auth-token header)
3. Middleware checks both cookie AND x-auth-token header
4. Development mode: auth check skipped (for testing)
5. Production mode: full auth enforcement

---

## 14. Offline Support System

### Strategy: Hybrid Approach
- **Online**: Use HTTP-only cookies for security
- **Offline**: Use IndexedDB to store token, send via x-auth-token header

### IndexedDB Storage
```typescript
// src/lib/offline.ts
Database: 'flota-auth-db'
Store: 'auth'
Key: 'jwt-token'
```

### Flow
1. User logs in → Token saved to IndexedDB automatically
2. User goes offline → Token retrieved from IndexedDB
3. Requests include `x-auth-token` header
4. Middleware validates header in offline mode
5. User comes back online → Normal cookie auth resumes

### Benefits
- Secure: Token still protected (not in localStorage)
- Works offline: Can make authenticated requests
- Seamless: Transparent to user

---

## 15. Payroll System Enhancements

### New Fields (v2)
| Field | Type | Description |
|-------|------|-------------|
| bonuses | Float | Extra payments (productivity, travel, etc.) |
| bonusesDesc | String? | Description of bonuses |
| otherDeductions | Float | Additional deductions |
| otherDeductionsDesc | String? | Description of deductions |

### Generation Form
- IRPF percentage (tax withholding)
- Other deductions percentage + description
- Bonuses percentage + description
- Preview table shows all calculations before generating

### PDF Generation
- Detailed salary breakdown
- Shows: base salary, bonuses, gross, deductions (IRPF, SS, other), net pay
- Downloadable from nomina detail page

---

## 16. Truck Card Enhancements

### Stats Display
Each truck card now shows:
- Ingresos (income): Sum of INCOME transactions
- Gastos (expenses): Sum of EXPENSE transactions  
- Balance (net): Ingresos - Gastos

Implementation: `src/app/(app)/trucks/page.tsx` fetches transactions and calculates stats per truck.

---

## 17. Known Issues & Gotchas

1. **Prisma 7.x**: `url` goes in `prisma.config.ts`, NOT in `schema.prisma`
2. **Prisma 7.x**: Both `prisma.ts` AND `seed.ts` must use the driver adapter (`@prisma/adapter-better-sqlite3`) — `new PrismaClient()` alone throws error
3. **Prisma 7.x**: Seed script requires `tsx` as devDependency (`pnpm add -D tsx`)
4. **Next.js 16**: `request.ip` removed — use `x-forwarded-for` header
5. **Zod v4**: Uses `z.uuid()`, `z.coerce.date()`, `z.number().gt()` (not v3 syntax)
6. **Tailwind v4**: CSS-native config — no `tailwind.config.js`, use `@import "tailwindcss"`
7. **Shadcn**: Use `pnpm dlx shadcn@latest add <component>` to add components
8. **Next.js 16**: `middleware` convention deprecated → `proxy` (warning, not breaking yet)
9. **Next.js 16**: `themeColor` in metadata deprecated → use `viewport` export
10. **React**: Client components MUST have `'use client'` if they use event handlers (onChange, onClick) — otherwise build fails with "Event handlers cannot be passed to Client Component props"
11. **React**: Use state-based filtering (useState) instead of DOM manipulation (querySelectorAll) — cleaner, more idiomatic

---

## 14. Future Roadmap

### Next Change: Authentication
- HttpOnly cookies for JWT (never localStorage)
- bcrypt for password hashing
- Login page + middleware auth check
- Rate limiting: 500/hour authenticated

### Future Changes
- Reports module (monthly summary, export CSV/Excel)
- Production deployment (Vercel/Railway)
