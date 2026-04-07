import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@flota.com')
    await page.locator('#password').fill('admin123')
    await page.getByRole('button', { name: /iniciar sesión/i }).click()
    await page.waitForURL('/dashboard')
  })

  test('debería cargar la página del dashboard', async ({ page }) => {
    await expect(page).toHaveTitle(/Flota Camiones/i)
  })

  test('debería mostrar las tarjetas de resumen', async ({ page }) => {
    // Check that summary cards are visible
    const cards = page.getByTestId('card')
    await expect(cards.first()).toBeVisible()
  })

  test('debería tener navegación funcional', async ({ page }) => {
    // Check navigation links exist in sidebar
    const navLinks = page.locator('nav a')
    await expect(navLinks.first()).toBeVisible()
  })

  test('debería mostrar saludo personalizado', async ({ page }) => {
    // Should show user greeting in header
    await expect(page.getByText(/hola/i)).toBeVisible()
  })
})
