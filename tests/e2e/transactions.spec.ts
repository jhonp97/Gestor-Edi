import { test, expect } from '@playwright/test'

test.describe('Transacciones', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@flota.com')
    await page.locator('#password').fill('admin123')
    await page.getByRole('button', { name: /iniciar sesión/i }).click()
    await page.waitForURL('/dashboard')

    // Navigate to transactions
    await page.goto('/transactions')
  })

  test('debería cargar la lista de transacciones', async ({ page }) => {
    await expect(page).toHaveTitle(/Flota Camiones/i)
    await expect(page.getByRole('heading', { name: /transacciones/i })).toBeVisible()
  })

  test('debería poder navegar a agregar transacción', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /Agregar Transacción/i })
    await expect(addButton).toBeVisible()

    await addButton.click()
    // Form should be visible after clicking
    await expect(page.getByLabel(/Camión/i)).toBeVisible()
  })

  test('debería validar campos del formulario', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /Agregar Transacción/i })
    await addButton.click()

    // Check required fields
    const amountInput = page.getByLabel(/Monto/i)
    const descInput = page.getByLabel(/Descripción/i)

    await expect(amountInput).toBeVisible()
    await expect(descInput).toBeVisible()
  })
})
