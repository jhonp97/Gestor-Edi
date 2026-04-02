import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('debería cargar la página principal', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/Flota Camiones/i)
  })

  test('debería mostrar las tarjetas de resumen', async ({ page }) => {
    await page.goto('/')

    // Check that summary cards are visible (they render with card data-slot)
    const cards = page.getByTestId('card')
    await expect(cards.first()).toBeVisible()
  })

  test('debería tener navegación funcional', async ({ page }) => {
    await page.goto('/')

    // Check navigation links exist
    const navLinks = page.locator('nav a, a[href*="trucks"], a[href*="transactions"]')
    await expect(navLinks.first()).toBeVisible()
  })
})
