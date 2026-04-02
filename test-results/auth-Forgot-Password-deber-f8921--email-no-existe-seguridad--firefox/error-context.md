# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Forgot Password >> debería mostrar éxito incluso si email no existe (seguridad)
- Location: tests\e2e\auth.spec.ts:225:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/email enviado/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/email enviado/i)

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img [ref=e6]
      - generic [ref=e9]: Restablecer Contraseña
      - generic [ref=e10]: Ingresá tu email y te enviaremos un enlace para crear una nueva contraseña
    - generic [ref=e12]:
      - generic [ref=e13]: Email inválido
      - generic [ref=e14]:
        - text: Email
        - textbox "Email" [ref=e15]:
          - /placeholder: tu@email.com
      - button "Enviar Enlace" [ref=e16]
    - link "Volver al inicio de sesión" [ref=e18] [cursor=pointer]:
      - /url: /login
  - button "Open Next.js Dev Tools" [ref=e24] [cursor=pointer]:
    - img [ref=e25]
  - alert [ref=e29]
```

# Test source

```ts
  132 | })
  133 | 
  134 | test.describe('Login', () => {
  135 |   test('debería mostrar el formulario de login', async ({ page }) => {
  136 |     await page.goto('/login')
  137 |     await page.waitForTimeout(1000)
  138 | 
  139 |     await expect(page.getByText('Iniciar Sesión').first()).toBeVisible()
  140 |     await expect(page.getByLabel('Email')).toBeVisible()
  141 |     await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible()
  142 |   })
  143 | 
  144 |   test('debería mostrar error con credenciales inválidas', async ({ page }) => {
  145 |     await page.goto('/login')
  146 | 
  147 |     await page.getByLabel('Email').fill('admin@flota.com')
  148 |     await page.getByLabel('Contraseña', { exact: true }).fill('wrongpassword')
  149 |     await page.getByRole('button', { name: /iniciar sesión/i }).click()
  150 | 
  151 |     await expect(page.getByText(/email o contraseña incorrectos/i)).toBeVisible()
  152 |   })
  153 | 
  154 |   test('debería mostrar error con email inexistente', async ({ page }) => {
  155 |     await page.goto('/login')
  156 | 
  157 |     await page.getByLabel('Email').fill('nonexistent@test.com')
  158 |     await page.getByLabel('Contraseña', { exact: true }).fill('somepassword')
  159 |     await page.getByRole('button', { name: /iniciar sesión/i }).click()
  160 | 
  161 |     await expect(page.getByText(/email o contraseña incorrectos/i)).toBeVisible()
  162 |   })
  163 | 
  164 |   test('debería tener link a registro', async ({ page }) => {
  165 |     await page.goto('/login')
  166 | 
  167 |     const registerLink = page.getByRole('link', { name: /crear cuenta/i })
  168 |     await expect(registerLink).toBeVisible()
  169 |     await registerLink.click()
  170 |     await page.waitForURL('/register')
  171 |   })
  172 | 
  173 |   test('debería tener link a forgot password', async ({ page }) => {
  174 |     await page.goto('/login')
  175 | 
  176 |     const forgotLink = page.getByRole('link', { name: /olvidaste tu contraseña/i })
  177 |     await expect(forgotLink).toBeVisible()
  178 |     await forgotLink.click()
  179 |     await page.waitForURL('/forgot-password')
  180 |   })
  181 | 
  182 |   test('debería enviar el formulario de login', async ({ page }) => {
  183 |     await page.goto('/login')
  184 | 
  185 |     await page.getByLabel('Email').fill('admin@flota.com')
  186 |     await page.getByLabel('Contraseña', { exact: true }).fill('admin123')
  187 | 
  188 |     const submitButton = page.getByRole('button', { name: /iniciar sesión/i })
  189 |     
  190 |     // Verify the button is enabled before clicking
  191 |     await expect(submitButton).toBeEnabled()
  192 |     
  193 |     // Click the button
  194 |     await submitButton.click()
  195 |     
  196 |     // Wait for any response (button might show loading state or page might change)
  197 |     await page.waitForTimeout(2000)
  198 |     
  199 |     // The test passes if we can interact with the form without errors
  200 |     // (The actual login/redirect behavior is tested at API level)
  201 |     expect(true).toBeTruthy()
  202 |   })
  203 | })
  204 | 
  205 | test.describe('Forgot Password', () => {
  206 |   test('debería mostrar el formulario de forgot password', async ({ page }) => {
  207 |     await page.goto('/forgot-password')
  208 |     await page.waitForTimeout(1000)
  209 | 
  210 |     await expect(page.getByText(/restablecer contraseña/i)).toBeVisible()
  211 |     await expect(page.getByLabel('Email')).toBeVisible()
  212 |     await expect(page.getByRole('button', { name: /enviar enlace/i })).toBeVisible()
  213 |   })
  214 | 
  215 |   test('debería mostrar mensaje de éxito al enviar email', async ({ page }) => {
  216 |     await page.goto('/forgot-password')
  217 | 
  218 |     await page.getByLabel('Email').fill('admin@flota.com')
  219 |     await page.getByRole('button', { name: /enviar enlace/i }).click()
  220 | 
  221 |     // Should show success message
  222 |     await expect(page.getByText(/email enviado/i)).toBeVisible()
  223 |   })
  224 | 
  225 |   test('debería mostrar éxito incluso si email no existe (seguridad)', async ({ page }) => {
  226 |     await page.goto('/forgot-password')
  227 | 
  228 |     await page.getByLabel('Email').fill('nonexistent@test.com')
  229 |     await page.getByRole('button', { name: /enviar enlace/i }).click()
  230 | 
  231 |     // Should still show success to prevent email enumeration
> 232 |     await expect(page.getByText(/email enviado/i)).toBeVisible()
      |                                                    ^ Error: expect(locator).toBeVisible() failed
  233 |   })
  234 | })
  235 | 
  236 | test.describe('Rutas Protegidas', () => {
  237 |   test('debería redirigir a login cuando no autenticado', async ({ page }) => {
  238 |     const protectedRoutes = ['/dashboard', '/trucks', '/transactions', '/workers', '/nomina']
  239 | 
  240 |     for (const route of protectedRoutes) {
  241 |       await page.goto(route)
  242 |       await page.waitForTimeout(500)
  243 |       expect(page.url()).toContain('/login')
  244 |     }
  245 |   })
  246 | })
  247 | 
  248 | test.describe('UI Components', () => {
  249 |   test('debería mostrar el icono de camión en las páginas de auth', async ({ page }) => {
  250 |     await page.goto('/login')
  251 |     await expect(page.locator('svg').first()).toBeVisible()
  252 | 
  253 |     await page.goto('/register')
  254 |     await expect(page.locator('svg').first()).toBeVisible()
  255 | 
  256 |     await page.goto('/forgot-password')
  257 |     await expect(page.locator('svg').first()).toBeVisible()
  258 |   })
  259 | 
  260 |   test('debería mostrar el tema de colores correcto', async ({ page }) => {
  261 |     await page.goto('/login')
  262 |     
  263 |     // Check that the primary color (#1e3a5f) is used
  264 |     const card = page.locator('[class*="bg-gradient"]').first()
  265 |     await expect(card).toBeVisible()
  266 |   })
  267 | })
  268 | 
```