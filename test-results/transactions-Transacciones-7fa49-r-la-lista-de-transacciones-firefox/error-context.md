# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transactions.spec.ts >> Transacciones >> debería cargar la lista de transacciones
- Location: tests\e2e\transactions.spec.ts:16:7

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
      - generic [ref=e12]: Iniciar Sesión
      - generic [ref=e13]: Ingresá tus datos para acceder a tu cuenta
    - generic [ref=e15]:
      - button "Continuar con Google" [ref=e16]:
        - img
        - text: Continuar con Google
      - generic [ref=e21]: o
      - generic [ref=e22]:
        - generic [ref=e23]:
          - text: Email
          - textbox "Email" [ref=e24]:
            - /placeholder: tu@email.com
        - generic [ref=e25]:
          - text: Contraseña
          - generic [ref=e26]:
            - textbox "Contraseña" [ref=e27]:
              - /placeholder: ••••••••
            - button "Mostrar contraseña" [ref=e28]:
              - img [ref=e29]
        - button "Iniciar Sesión" [ref=e32]
    - generic [ref=e33]:
      - link "¿Olvidaste tu contraseña?" [ref=e34] [cursor=pointer]:
        - /url: /forgot-password
      - paragraph [ref=e35]:
        - text: ¿No tenés cuenta?
        - link "Crear cuenta" [ref=e36] [cursor=pointer]:
          - /url: /register
  - button "Open Next.js Dev Tools" [ref=e42] [cursor=pointer]:
    - img [ref=e43]
  - alert [ref=e47]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Transacciones', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Login before each test
  6  |     await page.goto('/login')
  7  |     await page.getByLabel('Email').fill('admin@flota.com')
  8  |     await page.locator('#password').fill('admin123')
  9  |     await page.getByRole('button', { name: /iniciar sesión/i }).click()
> 10 |     await page.waitForURL('/dashboard')
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  11 | 
  12 |     // Navigate to transactions
  13 |     await page.goto('/transactions')
  14 |   })
  15 | 
  16 |   test('debería cargar la lista de transacciones', async ({ page }) => {
  17 |     await expect(page).toHaveTitle(/Flota Camiones/i)
  18 |     await expect(page.getByRole('heading', { name: /transacciones/i })).toBeVisible()
  19 |   })
  20 | 
  21 |   test('debería poder navegar a agregar transacción', async ({ page }) => {
  22 |     const addButton = page.getByRole('button', { name: /Agregar Transacción/i })
  23 |     await expect(addButton).toBeVisible()
  24 | 
  25 |     await addButton.click()
  26 |     // Form should be visible after clicking
  27 |     await expect(page.getByLabel(/Camión/i)).toBeVisible()
  28 |   })
  29 | 
  30 |   test('debería validar campos del formulario', async ({ page }) => {
  31 |     const addButton = page.getByRole('button', { name: /Agregar Transacción/i })
  32 |     await addButton.click()
  33 | 
  34 |     // Check required fields
  35 |     const amountInput = page.getByLabel(/Monto/i)
  36 |     const descInput = page.getByLabel(/Descripción/i)
  37 | 
  38 |     await expect(amountInput).toBeVisible()
  39 |     await expect(descInput).toBeVisible()
  40 |   })
  41 | })
  42 | 
```