# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Dashboard >> debería cargar la página del dashboard
- Location: tests\e2e\dashboard.spec.ts:13:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "/dashboard" until "load"
  navigated to "http://localhost:3000/login?callbackUrl=%2Fdashboard"
  navigated to "http://localhost:3000/login?callbackUrl=%2Fdashboard"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img [ref=e6]
      - generic [ref=e11]: Iniciar Sesión
      - generic [ref=e12]: Ingresá tus datos para acceder a tu cuenta
    - generic [ref=e14]:
      - button "Continuar con Google" [ref=e15]:
        - img
        - text: Continuar con Google
      - generic [ref=e20]: o
      - generic [ref=e21]:
        - generic [ref=e22]:
          - text: Email
          - textbox "Email" [ref=e23]:
            - /placeholder: tu@email.com
        - generic [ref=e24]:
          - text: Contraseña
          - generic [ref=e25]:
            - textbox "Contraseña" [ref=e26]:
              - /placeholder: ••••••••
            - button "Mostrar contraseña" [ref=e27]:
              - img [ref=e28]
        - button "Iniciar Sesión" [ref=e31]
    - generic [ref=e32]:
      - link "¿Olvidaste tu contraseña?" [ref=e33] [cursor=pointer]:
        - /url: /forgot-password
      - paragraph [ref=e34]:
        - text: ¿No tenés cuenta?
        - link "Crear cuenta" [ref=e35] [cursor=pointer]:
          - /url: /register
  - button "Open Next.js Dev Tools" [ref=e41] [cursor=pointer]:
    - img [ref=e42]
  - alert [ref=e45]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Dashboard', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Login before each test
  6  |     await page.goto('/login')
  7  |     await page.getByLabel('Email').fill('admin@flota.com')
  8  |     await page.locator('#password').fill('admin123')
  9  |     await page.getByRole('button', { name: /iniciar sesión/i }).click()
> 10 |     await page.waitForURL('/dashboard')
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  11 |   })
  12 | 
  13 |   test('debería cargar la página del dashboard', async ({ page }) => {
  14 |     await expect(page).toHaveTitle(/Flota Camiones/i)
  15 |   })
  16 | 
  17 |   test('debería mostrar las tarjetas de resumen', async ({ page }) => {
  18 |     // Check that summary cards are visible
  19 |     const cards = page.getByTestId('card')
  20 |     await expect(cards.first()).toBeVisible()
  21 |   })
  22 | 
  23 |   test('debería tener navegación funcional', async ({ page }) => {
  24 |     // Check navigation links exist in sidebar
  25 |     const navLinks = page.locator('nav a')
  26 |     await expect(navLinks.first()).toBeVisible()
  27 |   })
  28 | 
  29 |   test('debería mostrar saludo personalizado', async ({ page }) => {
  30 |     // Should show user greeting in header
  31 |     await expect(page.getByText(/hola/i)).toBeVisible()
  32 |   })
  33 | })
  34 | 
```