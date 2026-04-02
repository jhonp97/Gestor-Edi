import { test, expect } from '@playwright/test'

test.describe('Transacciones', () => {
  test('debería cargar la lista de transacciones', async ({ page }) => {
    await page.goto('/transactions')

    await expect(page).toHaveTitle(/Transacciones/i)
  })

  test('debería poder navegar a agregar transacción', async ({ page }) => {
    await page.goto('/transactions')

    const addButton = page.getByRole('button', { name: /Agregar Transacción/i })
    await expect(addButton).toBeVisible()

    await addButton.click()
    // Form should be visible after clicking
    await expect(page.getByLabel(/Camión/i)).toBeVisible()
  })

  test('debería validar campos del formulario', async ({ page }) => {
    await page.goto('/transactions')

    const addButton = page.getByRole('button', { name: /Agregar Transacción/i })
    await addButton.click()

    // Check required fields
    const amountInput = page.getByLabel(/Monto/i)
    const descInput = page.getByLabel(/Descripción/i)

    await expect(amountInput).toBeVisible()
    await expect(descInput).toBeVisible()
  })
})
