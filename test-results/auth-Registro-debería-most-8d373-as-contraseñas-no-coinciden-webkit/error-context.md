# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Registro >> debería mostrar error si las contraseñas no coinciden
- Location: tests\e2e\auth.spec.ts:53:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/las contraseñas no coinciden/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/las contraseñas no coinciden/i)

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img [ref=e6]
      - generic [ref=e11]: Crear Cuenta
      - generic [ref=e12]: Completá tus datos para registrarte
    - generic [ref=e14]:
      - generic [ref=e15]:
        - text: Nombre
        - textbox "Nombre" [active] [ref=e16]:
          - /placeholder: Tu nombre
      - generic [ref=e17]:
        - text: Email
        - textbox "Email" [ref=e18]:
          - /placeholder: tu@email.com
          - text: test-1775139322109-f1t3fi4a7w5@test.com
      - generic [ref=e19]:
        - text: Contraseña
        - generic [ref=e20]:
          - textbox "Contraseña" [ref=e21]:
            - /placeholder: Mínimo 8 caracteres
            - text: Password123
          - button "Mostrar contraseña" [ref=e22]:
            - img [ref=e23]
      - generic [ref=e26]:
        - text: Repetir Contraseña
        - generic [ref=e27]:
          - textbox "Repetir Contraseña" [ref=e28]:
            - /placeholder: Repetí tu contraseña
            - text: DifferentPassword
          - button "Mostrar contraseña" [ref=e29]:
            - img [ref=e30]
      - button "Crear Cuenta" [ref=e33]
    - paragraph [ref=e35]:
      - text: ¿Ya tenés cuenta?
      - link "Iniciar sesión" [ref=e36]:
        - /url: /login
  - button "Open Next.js Dev Tools" [ref=e42] [cursor=pointer]:
    - img [ref=e43]
  - alert [ref=e48]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | // Helper function to generate unique email for test isolation
  4   | function uniqueEmail() {
  5   |   return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`
  6   | }
  7   | 
  8   | test.describe('Landing Page', () => {
  9   |   test('debería mostrar la landing page para visitantes', async ({ page }) => {
  10  |     await page.goto('/')
  11  | 
  12  |     // Check hero section
  13  |     await expect(page.getByText(/controlá tu flota/i)).toBeVisible()
  14  |     
  15  |     // Check CTA buttons
  16  |     await expect(page.getByRole('link', { name: /crear cuenta/i }).first()).toBeVisible()
  17  |     await expect(page.getByRole('link', { name: /iniciar sesión/i }).first()).toBeVisible()
  18  |   })
  19  | 
  20  |   test('debería mostrar las funcionalidades', async ({ page }) => {
  21  |     await page.goto('/')
  22  | 
  23  |     // Check features section
  24  |     await expect(page.getByText(/gestión de camiones/i)).toBeVisible()
  25  |     await expect(page.getByText(/control de transacciones/i)).toBeVisible()
  26  |     await expect(page.getByText(/dashboard visual/i)).toBeVisible()
  27  |   })
  28  | 
  29  |   test('debería mostrar el footer con contacto', async ({ page }) => {
  30  |     await page.goto('/')
  31  | 
  32  |     // Scroll to footer
  33  |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  34  |     
  35  |     // Check footer
  36  |     await expect(page.getByText(/soporte@flotacamiones.com/i)).toBeVisible()
  37  |     await expect(page.getByText(/política de privacidad/i)).toBeVisible()
  38  |   })
  39  | })
  40  | 
  41  | test.describe('Registro', () => {
  42  |   test('debería mostrar el formulario de registro', async ({ page }) => {
  43  |     await page.goto('/register')
  44  |     await page.waitForTimeout(1000)
  45  | 
  46  |     await expect(page.getByText('Crear Cuenta').first()).toBeVisible()
  47  |     await expect(page.getByLabel('Nombre')).toBeVisible()
  48  |     await expect(page.getByLabel('Email')).toBeVisible()
  49  |     await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible()
  50  |     await expect(page.getByLabel('Repetir Contraseña')).toBeVisible()
  51  |   })
  52  | 
  53  |   test('debería mostrar error si las contraseñas no coinciden', async ({ page }) => {
  54  |     await page.goto('/register')
  55  | 
  56  |     await page.getByLabel('Nombre').fill('Test User')
  57  |     await page.getByLabel('Email').fill(uniqueEmail())
  58  |     await page.getByLabel('Contraseña', { exact: true }).fill('Password123')
  59  |     await page.getByLabel('Repetir Contraseña').fill('DifferentPassword')
  60  |     await page.getByRole('button', { name: /crear cuenta/i }).click()
  61  | 
> 62  |     await expect(page.getByText(/las contraseñas no coinciden/i)).toBeVisible()
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  63  |   })
  64  | 
  65  |   test('debería mostrar error si el email ya existe', async ({ page }) => {
  66  |     await page.goto('/register')
  67  | 
  68  |     await page.getByLabel('Nombre').fill('Test User')
  69  |     await page.getByLabel('Email').fill('admin@flota.com')
  70  |     await page.getByLabel('Contraseña', { exact: true }).fill('TestPassword123')
  71  |     await page.getByLabel('Repetir Contraseña').fill('TestPassword123')
  72  |     await page.getByRole('button', { name: /crear cuenta/i }).click()
  73  | 
  74  |     await expect(page.getByText(/email ya está registrado/i)).toBeVisible()
  75  |   })
  76  | 
  77  |   test('debería mostrar el toggle de visibilidad de contraseña', async ({ page }) => {
  78  |     await page.goto('/register')
  79  | 
  80  |     const passwordInput = page.getByLabel('Contraseña', { exact: true })
  81  |     const toggleButton = page.locator('button[aria-label*="contraseña"]').first()
  82  | 
  83  |     // Initially password type
  84  |     await expect(passwordInput).toHaveAttribute('type', 'password')
  85  | 
  86  |     // Click toggle
  87  |     await toggleButton.click()
  88  | 
  89  |     // Now should be text type
  90  |     await expect(passwordInput).toHaveAttribute('type', 'text')
  91  | 
  92  |     // Click again to hide
  93  |     await toggleButton.click()
  94  |     await expect(passwordInput).toHaveAttribute('type', 'password')
  95  |   })
  96  | 
  97  |   test('debería tener link a login', async ({ page }) => {
  98  |     await page.goto('/register')
  99  | 
  100 |     const loginLink = page.getByRole('link', { name: /iniciar sesión/i })
  101 |     await expect(loginLink).toBeVisible()
  102 |     await loginLink.click()
  103 |     await page.waitForURL('/login')
  104 |   })
  105 | 
  106 |   test('debería enviar el formulario de registro', async ({ page }) => {
  107 |     const email = uniqueEmail()
  108 |     const password = 'TestPassword123'
  109 | 
  110 |     await page.goto('/register')
  111 |     await page.getByLabel('Nombre').fill('Usuario Test')
  112 |     await page.getByLabel('Email').fill(email)
  113 |     await page.getByLabel('Contraseña', { exact: true }).fill(password)
  114 |     await page.getByLabel('Repetir Contraseña').fill(password)
  115 | 
  116 |     // Click submit and verify form submits (button changes state)
  117 |     const submitButton = page.getByRole('button', { name: /crear cuenta/i })
  118 |     await submitButton.click()
  119 | 
  120 |     // Should either show error or redirect (not stuck on same page)
  121 |     await page.waitForTimeout(2000)
  122 |     
  123 |     // Verify we're not still on register page with the same form state
  124 |     const isStillOnRegister = page.url().includes('/register')
  125 |     if (isStillOnRegister) {
  126 |       // If still on register, there should be an error message or the form should have changed
  127 |       const hasError = await page.getByText(/error/i).isVisible().catch(() => false)
  128 |       const buttonChanged = !(await submitButton.isEnabled())
  129 |       expect(hasError || buttonChanged || page.url().includes('/dashboard')).toBeTruthy()
  130 |     }
  131 |   })
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
```