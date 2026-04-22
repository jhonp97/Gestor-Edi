# Auditoría de Sistema de Autenticación - Reporte de Bugs

## Resumen Ejecutivo

El sistema de autenticación tiene **8 bugs críticos** que explican todos los problemas reportados:
1. Registro exitoso pero NO redirige al dashboard
2. Login manual NO funciona
3. Sesiones de Google y manual se mezclan
4. Admin no ve dashboard de admin

---

## BUGS CRÍTICOS ENCONTRADOS

### 🔴 BUG CRÍTICO #1: Token NO se guarda en localStorage
**Archivos:**
- `src/app/register/page.tsx` línea 52
- `src/app/login/page.tsx` líneas 52-56
- `src/app/api/auth/login/route.ts` línea 58

**Descripción:**
El flujo de auth está **ROTO POR DISEÑO**. El backend setea cookie HTTP-only `auth-token`, pero el `AuthProvider` solo lee de `localStorage` (línea 13 de auth-provider.tsx). El token NUNCA se guarda en localStorage porque:

1. El registro retorna `{ user: ... }` (línea 67 de register/route.ts) - NO incluye token
2. El login retorna `{ success: true, user: ... }` (línea 58 de login/route.ts) - NO incluye token
3. El cliente no tiene forma de obtener el token de la cookie HTTP-only

**Cadena de causas:**
```
Usuario registra → Backend setea cookie → Frontend redirige a /dashboard
     ↓
AuthProvider monta → localStorage.getItem('auth-token') → null
     ↓
!token && !isPublicRoute → router.push('/login') ← REDIRECCIÓN FORZADA
```

**Fix propuesto:**
```typescript
// En login/route.ts y register/route.ts, incluir token en respuesta:
return NextResponse.json({ 
  success: true, 
  user: result.user,
  token: result.token  // ← AGREGAR ESTO
}, { ... })

// En login/page.tsx y register/page.tsx, guardar en localStorage:
if (data.success) {
  localStorage.setItem('auth-token', data.token)  // ← AGREGAR ESTO
  window.location.href = '/dashboard'
}
```

---

### 🔴 BUG CRÍTICO #2: Middleware da PRIORIDAD a NextAuth sobre custom JWT
**Archivo:** `src/middleware.ts` líneas 86-102 vs 104-137

**Descripción:**
El middleware verifica `req.auth` (NextAuth) **ANTES** que la cookie `auth-token`. Esto significa que si hay CUALQUIER sesión de Google activa, el middleware usa esa identidad y **ignora completamente** el login manual.

```typescript
// Líneas 86-102 - NextAuth tiene prioridad
if (req.auth) {
  const user = req.auth.user
  response.headers.set('x-user-id', user?.id || '')
  response.headers.set('x-user-role', user?.role || 'USER')
  // ... usa sesión de Google
  return response
}

// Líneas 104-137 - Custom JWT solo si NO hay NextAuth
let token = req.cookies.get(COOKIE_NAME)?.value
// ... fallback a custom JWT
```

**Cadena de causas del problema #3 (sesiones mezcladas):**
```
Usuario tiene sesión Google activa como "usuario@gmail.com" (role: USER)
     ↓
Intenta login manual como "admin@empresa.com" (role: PLATFORM_ADMIN)
     ↓
Middleware: if (req.auth) → true (sesión Google todavía existe)
     ↓
Usa identidad de Google (usuario@gmail.com, role: USER)
     ↓
Ignora COMPLETAMENTE el login manual
```

**Fix propuesto:**
Hay dos opciones:

**Opción A - Forzar un solo sistema de auth:**
```typescript
// En login manual, invalidar sesión NextAuth primero
export async function POST(request: Request) {
  // ... validaciones ...
  const result = await authService.login(email, password)
  
  // Invalidar cualquier sesión NextAuth existente
  const response = NextResponse.json({ ... })
  response.cookies.delete('next-auth.session-token')  // ← AGREGAR
  response.cookies.delete('__Secure-next-auth.session-token')  // ← AGREGAR
  
  response.cookies.set('auth-token', result.token, COOKIE_OPTIONS)
  return response
}
```

**Opción B - Unificar identidad en el middleware:**
```typescript
// Verificar que ambas sesiones (si existen) sean del mismo usuario
if (req.auth && token) {
  const customPayload = await verifyToken(token)
  const nextAuthUser = req.auth.user
  
  // Si son usuarios diferentes, invalidar NextAuth
  if (customPayload.email !== nextAuthUser?.email) {
    // Invalidar sesión NextAuth y usar custom JWT
  }
}
```

---

### 🔴 BUG CRÍTICO #3: AuthProvider solo verifica localStorage (no cookies)
**Archivo:** `src/components/auth-provider.tsx` líneas 12-22

**Descripción:**
El `AuthProvider` es el único mecanismo de protección de rutas en el cliente, pero solo lee de `localStorage`. Esto crea una **inconsistencia total** con el middleware que usa cookies.

```typescript
const checkAuth = () => {
  const token = localStorage.getItem('auth-token')  // ← Solo localStorage!
  // ...
  if (!token && !isPublicRoute) {
    router.push('/login')  // ← Redirige aunque cookie exista
  }
}
```

**Fix propuesto:**
El AuthProvider debería consultar al backend para verificar la sesión:
```typescript
useEffect(() => {
  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session', { 
        credentials: 'include' 
      })
      if (!response.ok && !isPublicRoute) {
        router.push('/login')
      }
    } catch {
      if (!isPublicRoute) router.push('/login')
    }
  }
  checkAuth()
}, [pathname])
```

---

### 🟡 BUG #4: Inconsistencia en duración de cookies
**Archivos:**
- `src/app/api/auth/register/route.ts` línea 13: `maxAge: 8 * 60 * 60` (8 horas)
- `src/app/api/auth/login/route.ts` línea 65: `maxAge: 60 * 60 * 24 * 7` (7 días)

**Fix propuesto:**
```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,  // 7 días para AMBOS
}
```

---

### 🟡 BUG #5: Logout no limpia cookies de NextAuth
**Archivo:** `src/components/layout/sidebar.tsx` líneas 41-55

**Descripción:**
El logout actual:
1. Llama a `/api/auth/logout` (desconocido si existe)
2. Limpia `localStorage.removeItem('auth-token')`
3. Limpia IndexedDB `clearOfflineToken()`
4. **NUNCA** limpia la cookie httpOnly `auth-token`
5. **NUNCA** llama a `signOut()` de NextAuth

Esto deja la sesión de Google activa aunque el usuario "haya cerrado sesión".

**Fix propuesto:**
```typescript
import { signOut } from 'next-auth/react'

async function handleLogout() {
  setLoggingOut(true)
  
  // 1. Cerrar sesión NextAuth (si existe)
  await signOut({ redirect: false })
  
  // 2. Limpiar localStorage
  localStorage.removeItem('auth-token')
  await clearOfflineToken()
  
  // 3. El backend debe invalidar la cookie
  await fetch('/api/auth/logout', { 
    method: 'POST',
    credentials: 'include' 
  })
  
  // 4. Forzar recarga completa
  window.location.href = '/login'
}
```

---

### 🟡 BUG #6: Cookie `secure` depende de NODE_ENV (problema en Vercel)
**Archivos:**
- `src/app/api/auth/register/route.ts` línea 10
- `src/app/api/auth/login/route.ts` línea 62

**Descripción:**
```typescript
secure: process.env.NODE_ENV === 'production'
```

En Vercel (y otros hosts), el proxy termina SSL y la app corre en HTTP internamente. `NODE_ENV === 'production'` puede ser true, pero si hay problemas con el proxy, las cookies seguras no se envían.

**Fix propuesto:**
Usar detección más robusta:
```typescript
secure: process.env.NODE_ENV === 'production' && 
        process.env.VERCEL !== '1' ? true : false
// O mejor aún, usar variable explícita:
secure: process.env.COOKIE_SECURE === 'true'
```

---

### 🟡 BUG #7: API de session no retorna role correctamente para admin
**Archivo:** `src/app/api/auth/session/route.ts` líneas 12-23

**Descripción:**
Cuando hay sesión de NextAuth, retorna `user.role` directamente del token JWT de NextAuth. Pero el token de NextAuth puede tener un role desactualizado si el usuario fue promovido a admin después de iniciar sesión.

**Fix propuesto:**
Siempre consultar la base de datos para el role actual:
```typescript
if (nextAuthSession?.user) {
  // Fetch fresh role from DB
  const dbUser = await prisma.user.findUnique({
    where: { id: nextAuthSession.user.id },
    select: { id: true, name: true, email: true, role: true, organizationId: true }
  })
  return NextResponse.json({ user: dbUser })
}
```

---

### 🟡 BUG #8: Dev mode en middleware desactiva toda protección
**Archivo:** `src/middleware.ts` líneas 65-79

**Descripción:**
En desarrollo (`NODE_ENV !== 'production'`), el middleware solo lee el header `x-auth-token` pero **NUNCA redirige**. Esto permite acceder a cualquier ruta protegida sin autenticación en desarrollo.

```typescript
if (process.env.NODE_ENV !== 'production') {
  const authHeader = req.headers.get('x-auth-token')
  if (authHeader) {
    // Setea headers pero NUNCA valida rutas protegidas
    return response  // ← Siempre permite el acceso!
  }
}
```

**Fix propuesto:**
El comportamiento de dev debería ser configurable, no siempre abierto:
```typescript
if (process.env.NODE_ENV !== 'production' && process.env.SKIP_AUTH === 'true') {
  // Solo saltear auth si se explicita
  return response
}
// Resto del middleware normal
```

---

## PREGUNTAS ESPECÍFICAS RESPONDIDAS

### 1. ¿Por qué el registro podría NO redirigir al dashboard aunque retorne 201?
**Respuesta:** Porque el token se setea en cookie HTTP-only pero el `AuthProvider` solo lee de `localStorage`. Como el token no está en localStorage, el provider redirige a `/login`.

### 2. ¿Por qué el login manual podría NO funcionar si el usuario existe?
**Respuesta:** Por el mismo problema del registro - el token no llega al localStorage. Además, si hay una sesión de Google previa, el middleware la prioriza y usa esa identidad en lugar de la del login manual.

### 3. ¿Cómo interactúan las dos sesiones? ¿Se pueden mezclar?
**Respuesta:** **SÍ se mezclan y es un desastre**. El middleware da prioridad absoluta a NextAuth. Si hay sesión de Google activa, ignora completamente el login manual. Esto causa que un usuario logueado manualmente como admin sea tratado como el usuario de Google.

### 4. ¿El middleware da preferencia a NextAuth? ¿Por qué?
**Respuesta:** **SÍ**. El orden del código es:
1. Línea 87: `if (req.auth)` - revisa NextAuth primero
2. Línea 104: revisa cookie custom solo si no hay NextAuth

Esto fue una decisión de diseño (probablemente accidental) que pone a NextAuth como "primera clase".

### 5. ¿Hay problema con `credentials: 'include'`?
**Respuesta:** No es un bug en sí, pero es inconsistente. El hook `useApi` usa `credentials: 'include'` correctamente para enviar cookies al backend, pero el `AuthProvider` no usa este mecanismo para verificar auth.

### 6. ¿La API de session verifica AMBAS sesiones?
**Respuesta:** SÍ, pero de forma problemática:
1. Primero revisa NextAuth (línea 12)
2. Si no hay, revisa cookie custom (línea 26)

El problema es que si hay AMBAS, solo retorna NextAuth. No hay unificación.

### 7. ¿Problema con `secure: process.env.NODE_ENV === 'production'` en Vercel?
**Respuesta:** Podría haber problemas si el proxy de Vercel no maneja correctamente los headers de forwarding. Además, en previews de Vercel (deployments de PR), `NODE_ENV` suele ser 'production' pero el dominio es diferente, causando problemas con cookies.

---

## TESTS QUE DEBERÍAN EXISTIR

### Test 1: Login manual debe funcionar con sesión Google previa
```typescript
test('login manual debe invalidar sesión Google previa', async () => {
  // 1. Login con Google
  await signIn('google')
  
  // 2. Login manual con diferente usuario
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'otro@user.com', password: 'pass' })
  })
  
  // 3. Verificar que la sesión ahora es del usuario manual
  const session = await fetch('/api/auth/session')
  expect(session.user.email).toBe('otro@user.com')
})
```

### Test 2: Registro debe permitir acceso inmediato al dashboard
```typescript
test('registro debe redirigir al dashboard', async () => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test', email: 'test@test.com', password: 'password123' })
  })
  
  expect(response.status).toBe(201)
  expect(response.cookies.get('auth-token')).toBeDefined()
  
  // Simular navegación al dashboard
  const dashboard = await fetch('/dashboard', {
    headers: { Cookie: response.headers.get('set-cookie') }
  })
  expect(dashboard.status).toBe(200)  // No redirección
})
```

### Test 3: Middleware debe unificar sesiones consistentemente
```typescript
test('middleware debe usar custom JWT cuando difiere de NextAuth', async () => {
  // Setup: crear token JWT para usuario A
  const token = generateToken('user-a@example.com')
  
  // Setup: sesión NextAuth para usuario B
  const nextAuthSession = createMockSession('user-b@example.com')
  
  const response = await middleware({
    cookies: { 'auth-token': token },
    auth: nextAuthSession
  })
  
  // Debería usar el custom JWT (más reciente)
  expect(response.headers.get('x-user-email')).toBe('user-a@example.com')
})
```

### Test 4: Logout debe limpiar AMBOS sistemas
```typescript
test('logout debe limpiar cookies de ambos sistemas', async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  
  // Verificar cookie custom eliminada
  expect(document.cookie).not.toContain('auth-token')
  
  // Verificar NextAuth limpiado
  const session = await getSession()
  expect(session).toBeNull()
})
```

### Test 5: Admin role debe persistir correctamente
```typescript
test('PLATFORM_ADMIN debe ver panel de admin', async () => {
  const token = generateToken({ email: 'admin@test.com', role: 'PLATFORM_ADMIN' })
  
  const response = await fetch('/admin', {
    headers: { Cookie: `auth-token=${token}` }
  })
  
  expect(response.status).toBe(200)
  expect(response.headers.get('x-user-role')).toBe('PLATFORM_ADMIN')
})
```

---

## RECOMENDACIONES DE ARQUITECTURA

### Opción 1: Unificar en un solo sistema (Recomendado)
Migrar todo a NextAuth con Credentials Provider. Eliminar el sistema custom JWT.

**Pros:**
- Un solo sistema de auth
- Menos código mantener
- NextAuth maneja sesiones, refresh tokens, etc.

**Cons:**
- Cambio grande
- Requiere migración de usuarios existentes

### Opción 2: Mantener ambos pero con lógica de unificación
Mejorar el middleware para que:
1. Detecte cuando hay conflicto entre sesiones
2. Priorice la sesión más reciente
3. Limpié la sesión obsoleta

### Opción 3: Separar completamente (auth por dominio)
- Google OAuth para ciertas rutas
- Custom JWT para otras
- Sin mezcla posible

---

## PLAN DE FIX INMEDIATO (Hotfix)

1. **HOTFIX 1** - Agregar token a respuestas de login/register
2. **HOTFIX 2** - Guardar token en localStorage en frontend
3. **HOTFIX 3** - En login manual, invalidar sesión NextAuth
4. **HOTFIX 4** - En logout, llamar a `signOut()` de NextAuth
5. **HOTFIX 5** - Unificar duración de cookies

Estos 5 fixes resolverían los 4 problemas reportados por el usuario.
