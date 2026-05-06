# 🔒 AUDITORÍA DE SEGURIDAD OWASP + FUNCIONALIDAD — Gestor-EDI

> Fecha: 2026-05-06  
> Auditor: SDD Explore Agent  
> Alcance: Next.js 16 + TypeScript + Tailwind + Prisma + PostgreSQL + PWA

---

## RESUMEN EJECUTIVO

**Riesgo General: 🔴 CRÍTICO**

Se detectaron **3 vulnerabilidades CRÍTICAS** que requieren acción inmediata:
1. `.env` con secrets de producción hardcodeados y commiteados en git.
2. `DNI_ENCRYPTION_KEY = 00000000000000000000000000000000` (clave de cifrado trivial).
3. Middleware desactiva autenticación en modo no-producción, permitiendo acceso anónimo a TODO.

Además, existen múltiples hallazgos de severidad ALTA y MEDIO.

---

## PARTE A: FUNCIONALIDAD DE NEGOCIO

### 1. Dashboard
| Ítem | Estado | Notas |
|------|--------|-------|
| Carga datos | ✅ | Usa `prisma.transaction` con filtros por `organizationId` |
| Filtra por org | ✅ | `session.user.organizationId` usado en todas las queries |
| Vistas admin/user | ❌ | No hay diferenciación de vistas. Admin y user ven el mismo dashboard |
| Rate limiting | ⚠️ | No aplica (Server Component), pero tampoco hay protección anti-abuso en la página |

**Recomendación:** Agregar vista admin con métricas globales opcional, o al menos un indicador de rol.

---

### 2. Admin Panel
| Ítem | Estado | Notas |
|------|--------|-------|
| Verifica PLATFORM_ADMIN | ✅ | Middleware (`middleware.ts:99`, `middleware.ts:124`) y APIs (`/api/admin/*`) verifican `role === 'PLATFORM_ADMIN'` |
| Gestión de users | ✅ | `/api/admin/users` con GET, PATCH (cambio de rol), DELETE |
| Gestión de orgs | ✅ | `/api/admin/orgs` con paginación |
| Rate limiting | ✅ | Admin endpoints usan `ADMIN_RATE_LIMIT` (100 req/15min) |

**Nota:** Las páginas admin son Client Components que consumen las APIs. Si las APIs están protegidas, el frontend mostrará error 403. Esto está bien.

---

### 3. Workers
| Ítem | Estado | Notas |
|------|--------|-------|
| CRUD funciona | ✅ | POST, GET, PATCH, DELETE en `/api/workers/*` |
| Filtra por org | ✅ | `WorkerRepository(user.organizationId)` usado en todas las operaciones |
| Relación con trucks | ✅ | `truckId` validado contra `prisma.truck.findFirst({ organizationId })` |
| DNI encryption | ✅ | DNI se cifra con AES-256-CBC al crear/editar |
| DNI en detail page | ⚠️ | Se muestra DNI en plaintext en `workers/[id]/page.tsx:70`. Solo accesible dentro de la org, pero sin audit log |

**Recomendación:** Considerar masking del DNI en vistas de detalle para roles no-admin.

---

### 4. Trucks
| Ítem | Estado | Notas |
|------|--------|-------|
| CRUD funciona | ✅ | POST, GET, PATCH, DELETE en `/api/trucks/*` |
| Filtra por org | ✅ | `organizationId` en todas las queries Prisma |
| Stats calculados | ✅ | Ingresos/gastos calculados desde transactions en `trucks/page.tsx` |
| Validación body | ⚠️ | PATCH en `/api/trucks/[id]/route.ts` no usa Zod — validación manual básica |

---

### 5. Transactions
| Ítem | Estado | Notas |
|------|--------|-------|
| Filtra por org | ✅ | `organizationId` en todas las queries |
| CRUD funciona | ✅ | POST en `/api/transactions/route.ts` |
| Cálculos correctos | ✅ | Agregaciones con `prisma.transaction.aggregate` en dashboard |
| Validación body | ❌ | `/api/transactions/route.ts` NO usa Zod. Pasa `body` directo al servicio |

**Recomendación:** Agregar `transactionSchema` con Zod para validar `amount`, `type`, `date`, `truckId`.

---

### 6. Nómina / Payroll
| Ítem | Estado | Notas |
|------|--------|-------|
| Generación funciona | ✅ | `/api/payroll/generate` crea registros en bulk con skip de duplicados |
| PDF funciona | ✅ | `@react-pdf/renderer` con `NominaDocument` en `src/lib/pdf/nomina-document.tsx` |
| Cálculo IRPF | ⚠️ | Se calcula sobre `baseSalary`, NO sobre `grossPay` (base + bono). Fiscamente incorrecto en España |
| Cálculo SS | ⚠️ | Se calcula sobre `baseSalary`, NO sobre `grossPay`. En España SS se aplica al bruto total |
| Validación endpoint | ❌ | `/api/payroll/generate/route.ts` NO usa Zod. Solo valida `month` y `year` |
| Rate limiting | ❌ | Payroll endpoints NO tienen rate limiting |

**Recomendación:**
- Corregir cálculo: `irpfAmount = grossPay * (irpf / 100)` (no baseSalary).
- Corregir cálculo: `ssAmount = grossPay * (SS_PERCENT / 100)` (no baseSalary).
- Agregar Zod schema para validar body.

---

### 7. Profile
| Ítem | Estado | Notas |
|------|--------|-------|
| Solo ve su perfil | ✅ | `profileService.getProfile(session.user.id)` — no acepta `userId` externo |
| Solo edita su perfil | ✅ | `profileService.updateProfile(session.user.id, ...)` |
| Cambio de password | ✅ | Requiere `currentPassword`, verifica con bcrypt |
| Rate limiting | ✅ | PATCH de profile tiene `PROFILE_RATE_LIMIT` (50 req/15min) |
| Zod validation | ✅ | `updateProfileSchema` usado en `/api/profile/route.ts` |

---

## PARTE B: SEGURIDAD OWASP TOP 10

### A01: Broken Access Control

| Hallazgo | Severidad | Estado | Detalle |
|----------|-----------|--------|---------|
| Middleware desactiva auth en dev | 🔴 **CRÍTICO** | ❌ | `middleware.ts:65-78`: si `NODE_ENV !== 'production'`, retorna `response` sin verificar autenticación. **Cualquiera puede acceder a rutas protegidas sin login.** Si la app se despliega sin `NODE_ENV=production`, está completamente expuesta. |
| `x-auth-token` header aceptado | 🟠 **ALTO** | ❌ | `auth-edge.ts:31-34` y `middleware.ts:91-92` aceptan `x-auth-token` header. Un atacante puede usar un JWT robado o forjado (si conoce el secret) para autenticarse. |
| Headers `x-user-*` seteados en response | 🟠 **ALTO** | ❌ | `middleware.ts:70-75` y `103-108` setean headers `x-user-id`, `x-user-role`, etc. en la response. Aunque esto es la response al cliente, refleja información sensible que podría ser leída por scripts. |
| APIs de admin verifican rol | 🟢 **BIEN** | ✅ | `/api/admin/*` verifican `role === 'PLATFORM_ADMIN'` antes de procesar |
| Filtrado por org en CRUD | 🟢 **BIEN** | ✅ | Workers, trucks, transactions filtran por `organizationId` |
| No hay validación de propiedad en algunos GETs | 🟡 **MEDIO** | ⚠️ | `workers/[id]/route.ts` GET valida `organizationId`, pero `trucks/[id]/route.ts` GET también. Está OK en general. |

**Recomendación CRÍTICA:**
1. ELIMINAR el bypass de auth en desarrollo del middleware. Usar `x-auth-token` solo si hay un mecanismo de firma/verificación robusto.
2. No setear `x-user-*` headers en la response.
3. Asegurar que `NODE_ENV=production` esté siempre seteado en deploy.

---

### A02: Cryptographic Failures

| Hallazgo | Severidad | Estado | Detalle |
|----------|-----------|--------|---------|
| `DNI_ENCRYPTION_KEY = 000...000` | 🔴 **CRÍTICO** | ❌ | `.env:55`: La clave de cifrado AES-256-CBC es **32 ceros**. Técnicamente los DNIs están cifrados, pero cualquiera puede descifrarlos con esta clave trivial. |
| Secrets hardcodeados en `.env` | 🔴 **CRÍTICO** | ❌ | `.env` contiene: JWT_SECRET, NEXTAUTH_SECRET, DATABASE_URL (con password), GOOGLE_CLIENT_SECRET, RESEND_API_KEY, CLOUDINARY_API_SECRET, VERCEL_OIDC_TOKEN. **Todo está en el repo de git.** |
| Uso de `bcryptjs` | 🟡 **MEDIO** | ⚠️ | `auth.service.ts` usa `bcryptjs` con cost 12. No es inseguro, pero `argon2` es el estándar moderno. |
| DNI cifrado en reposo | 🟢 **BIEN** | ✅ | `encryption.ts` usa AES-256-CBC con IV aleatorio. El formato `iv:ciphertext` es correcto. |
| Hash SHA-256 para lookups | 🟢 **BIEN** | ✅ | Se usa `dniHash` para búsquedas exactas sin exponer el DNI |

**Recomendación CRÍTICA:**
1. **ROTAR INMEDIATAMENTE** TODOS los secrets: JWT_SECRET, NEXTAUTH_SECRET, DATABASE_PASSWORD, GOOGLE_CLIENT_SECRET, RESEND_API_KEY, CLOUDINARY_API_SECRET.
2. Generar `DNI_ENCRYPTION_KEY` con `crypto.randomBytes(32).toString('hex')`.
3. Mover `.env` a `.env.local` y agregarlo a `.gitignore`.
4. Considerar migrar de `bcryptjs` a `argon2`.

---

### A03: Injection

| Hallazgo | Severidad | Estado | Detalle |
|----------|-----------|--------|---------|
| No hay raw queries en Prisma | 🟢 **BIEN** | ✅ | `grep` no encontró `$queryRaw`, `$executeRaw` ni `queryRawUnsafe` |
| Auth endpoints validan con Zod | 🟢 **BIEN** | ✅ | `loginSchema`, `registerSchema`, `forgotPasswordSchema`, `resetPasswordSchema` usados |
| Workers POST sin Zod | 🟡 **MEDIO** | ❌ | `/api/workers/route.ts` recibe `body` y lo pasa directamente al servicio sin schema Zod |
| Trucks PATCH sin Zod | 🟡 **MEDIO** | ❌ | `/api/trucks/[id]/route.ts` desestructura manualmente `plate`, `brand`, etc. sin validación de tipos |
| Payroll generate sin Zod | 🟡 **MEDIO** | ❌ | `/api/payroll/generate/route.ts` valida manualmente `month`, `year` pero no el resto del body |
| Transactions POST sin Zod | 🟡 **MEDIO** | ❌ | `/api/transactions/route.ts` pasa `body` directo al servicio |

**Recomendación:** Crear Zod schemas para `worker`, `truck`, `transaction`, `payroll` y usarlos en TODOS los endpoints.

---

### A05: Security Misconfiguration

| Hallazgo | Severidad | Estado | Detalle |
|----------|-----------|--------|---------|
| `.env` commiteado en git | 🔴 **CRÍTICO** | ❌ | El archivo `.env` está en el repo con credenciales reales. Esto es una fuga de datos masiva. |
| CSP con `unsafe-inline` y `unsafe-eval` | 🟠 **ALTO** | ❌ | `middleware.ts:54`: `script-src 'self' 'unsafe-inline' 'unsafe-eval'` debilita protección XSS. |
| `X-XSS-Protection: 1; mode=block` | 🟡 **MEDIO** | ⚠️ | Deprecado por Chrome y puede causar side-channel attacks. Mejor eliminarlo. |
| HSTS configurado | 🟢 **BIEN** | ✅ | `next.config.ts:12`: `max-age=63072000; includeSubDomains; preload` |
| X-Frame-Options | 🟢 **BIEN** | ✅ | `SAMEORIGIN` en next.config, `DENY` en middleware |
| X-Content-Type-Options | 🟢 **BIEN** | ✅ | `nosniff` en ambos lugares |
| No hay stack traces expuestos | 🟢 **BIEN** | ✅ | Los endpoints retornan `"Error interno del servidor"` en producción |

**Recomendación:**
1. Eliminar `.env` del repo git (`git rm --cached .env`) y agregarlo a `.gitignore`.
2. Revisar CSP: eliminar `'unsafe-eval'` si no es estrictamente necesario. Para `'unsafe-inline'`, considerar nonces.
3. Eliminar `X-XSS-Protection` header.

---

### A07: Authentication Failures

| Hallazgo | Severidad | Estado | Detalle |
|----------|-----------|--------|---------|
| Rate limiting en login | 🟢 **BIEN** | ✅ | `AUTH_RATE_LIMIT`: 10 req/15min por IP |
| Rate limiting en register | 🟢 **BIEN** | ✅ | Mismo límite que login |
| **NO hay rate limiting en forgot-password** | 🟠 **ALTO** | ❌ | `/api/auth/forgot-password/route.ts` NO tiene rate limit. Permite enumeración de emails y spam de envío de links. |
| **NO hay rate limiting en reset-password** | 🟠 **ALTO** | ❌ | `/api/auth/reset-password/route.ts` NO tiene rate limit. Permite brute force de tokens. |
| Password reset token seguro | 🟢 **BIEN** | ✅ | `crypto.randomBytes(32)`, expira en 1 hora (`RESET_TOKEN_EXPIRY_HOURS = 1`), single-use (`used` flag) |
| JWT expiry | 🟡 **MEDIO** | ⚠️ | `JWT_EXPIRY = '8h'` es largo. Considerar 1-2h con refresh token. |
| Cookie `auth-token` | 🟢 **BIEN** | ✅ | `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'` |
| Cookie `maxAge` | 🟡 **MEDIO** | ⚠️ | Login cookie `maxAge: 60 * 60 * 24 * 7` (7 días). Muy largo para una sesión. Register cookie `maxAge: 8 * 60 * 60` (8h) — inconsistente. |

**Recomendación:**
1. Agregar `AUTH_RATE_LIMIT` a `forgot-password` y `reset-password`.
2. Reducir JWT expiry a 1-2h e implementar refresh tokens.
3. Unificar cookie maxAge (recomendado: 8h para sesión, 7 días para "recordarme" opcional).

---

### A08: Data Integrity Failures

| Hallazgo | Severidad | Estado | Detalle |
|----------|-----------|--------|---------|
| CSRF protection | 🟡 **MEDIO** | ⚠️ | No hay protección CSRF explícita en API routes. Las cookies son `sameSite: 'lax'`, lo que protege contra CSRF cross-site en POST/PUT/PATCH/DELETE, pero NO contra ataques desde subdominios o si el navegador ignora SameSite. |
| Upload signature protegido | 🟢 **BIEN** | ✅ | `/api/upload/signature` requiere sesión y rate limit antes de generar firma Cloudinary |
| No hay tokens CSRF para formularios | 🟡 **MEDIO** | ⚠️ | Los formularios POST no incluyen token CSRF. Depende exclusivamente de SameSite=Lax. |

**Recomendación:** Considerar implementar tokens CSRF para operaciones sensibles (cambio de contraseña, eliminación de datos, generación de nómina).

---

### A10: SSRF

| Hallazgo | Severidad | Estado | Detalle |
|----------|-----------|--------|---------|
| Requests a URLs externas | 🟡 **MEDIO** | ✅ | `avatar-upload.tsx` hace `fetch` a `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`. `cloudName` viene de variable de entorno (`NEXT_PUBLIC_APP_URL` / `cloudName`), NO del usuario. Riesgo bajo. |
| No hay URLs controladas por usuario | 🟢 **BIEN** | ✅ | No se encontraron endpoints que reciban URLs de usuario y hagan requests |

---

## PARTE C: GDPR / RGPD

| Ítem | Estado | Detalle |
|------|--------|---------|
| Data export por org | ✅ | `/api/data/export/route.ts` usa `session.user.organizationId`. No permite exportar otras orgs. |
| Data export con DNI descifrados | 🟡 **MEDIO** | `data-export.service.ts` descifra DNIs en el export. Incluye advertencia legal, pero el archivo JSON está en plaintext. Considerar cifrar el archivo ZIP o requerir 2FA. |
| Audit log en export | ✅ | `auditService.log('DATA_EXPORT', ...)` con IP y user-agent |
| Data deletion (soft) | ✅ | `/api/data/delete-request` setea `deletedAt` y `deletionRequestedAt` |
| Bloqueo último admin | ✅ | Verifica que no sea el último `ORG_ADMIN` antes de permitir delete request |
| Purge automático | ✅ | `/api/data/purge/route.ts` hard-deletea tras 30 días, protegido con `CRON_SECRET` |
| Audit log en delete request | ✅ | `auditService.log('DATA_DELETE_REQUEST', ...)` |
| Consentimiento cookies | ✅ | Banner de cookies con `useConsent` hook y `/api/consent` |
| DNI cifrado en DB | ✅ | AES-256-CBC con IV aleatorio |
| DNI mostrado en UI | ⚠️ | Workers detail page muestra DNI en plaintext. Solo accesible dentro de la org, pero sin audit log de visualización. |

**Recomendación:**
1. Agregar log de "quién vio el DNI" en `workers/[id]/page.tsx` o el endpoint correspondiente.
2. Considerar cifrar el archivo de exportación (ej. ZIP con password) antes de descargar.

---

## RESUMEN DE HALLAZGOS POR SEVERIDAD

| Severidad | Cantidad | Hallazgos clave |
|-----------|----------|-----------------|
| 🔴 **CRÍTICO** | 3 | `.env` con secrets reales, `DNI_ENCRYPTION_KEY=000...000`, middleware desactiva auth en dev |
| 🟠 **ALTO** | 6 | `x-auth-token` header aceptado, headers `x-user-*` expuestos, forgot-password sin rate limit, reset-password sin rate limit, CSP `unsafe-inline`/`unsafe-eval`, `.env` en git |
| 🟡 **MEDIO** | 10 | Cálculo IRPF/SS incorrecto, varios endpoints sin Zod, `X-XSS-Protection` deprecado, JWT 8h, cookie maxAge 7 días, CSRF no explícito, DNI en export plaintext, DNI visible en UI sin audit, payroll sin rate limit, `bcryptjs` vs `argon2` |
| 🟢 **BIEN** | 15 | Filtrado por org, verificación de rol admin, rate limiting en login/register, DNI cifrado en DB, password reset tokens seguros, purge protegido, audit logs en operaciones sensibles, HSTS, X-Frame-Options, no raw queries, no stack traces expuestos |

---

## ACCIONES INMEDIATAS REQUERIDAS (ordenadas por prioridad)

### 🔴 Prioridad 1 — Hacer HOY

1. **Rotar TODOS los secrets** expuestos en `.env`:
   - `DATABASE_URL` / `DIRECT_URL` (cambiar password de Supabase)
   - `JWT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET`
   - `GOOGLE_CLIENT_SECRET`
   - `RESEND_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `DNI_ENCRYPTION_KEY` (generar nueva y re-cifrar TODOS los DNIs existentes)
   - `CRON_SECRET`
   - `VERCEL_OIDC_TOKEN` (si aplica)

2. **Eliminar `.env` del historial de git**:
   ```bash
   git rm --cached .env
   echo ".env" >> .gitignore
   git commit -m "security: remove .env from git history"
   ```
   Luego usar `git filter-repo` o BFG Repo-Cleaner para eliminarlo del historial COMPLETO.

3. **Generar nueva `DNI_ENCRYPTION_KEY`**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Y ejecutar un script de migración para re-cifrar todos los DNIs existentes.

### 🟠 Prioridad 2 — Esta semana

4. **Corregir el middleware** (`middleware.ts:65-78`): eliminar el bypass de autenticación en desarrollo. Usar variables de entorno separadas para "modo debug" si es necesario.

5. **Agregar rate limiting** a:
   - `/api/auth/forgot-password`
   - `/api/auth/reset-password`
   - `/api/payroll/generate`

6. **Corregir cálculos de nómina** en `nomina/generar/page.tsx` y `/api/payroll/generate/route.ts`:
   - `irpfAmount = grossPay * (irpf / 100)`
   - `ssAmount = grossPay * (SS_PERCENT / 100)`

7. **Agregar Zod schemas** a todos los endpoints POST/PATCH que no lo tengan:
   - `truckSchema`, `workerSchema`, `transactionSchema`, `payrollGenerateSchema`

### 🟡 Prioridad 3 — Próximo sprint

8. **Eliminar headers `x-user-*`** del middleware response.
9. **Eliminar `X-XSS-Protection`** del middleware.
10. **Revisar CSP**: eliminar `'unsafe-eval'` si es posible, considerar nonces para `'unsafe-inline'`.
11. **Implementar refresh tokens** y reducir JWT expiry a 1-2h.
12. **Agregar audit log** para visualización de DNI en `workers/[id]`.
13. **Cifrar archivo de data export** (ZIP con password) antes de descargar.
14. **Migrar de `bcryptjs` a `argon2`**.

---

*Fin del reporte. Si necesitás que genere los fixes de código para alguno de estos hallazgos, avisá y lo hacemos.*
