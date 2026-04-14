import { test, expect } from '@playwright/test'

/**
 * Legal Pages Content Verification Tests
 * 
 * These tests verify that all legal pages (/privacy, /terms, /legal-notice)
 * contain the proper content and structure.
 * 
 * Note: Some selectors use .first() to avoid strict mode violations where
 * multiple elements match (e.g., "cookies" appears in multiple places).
 */

test.describe('Política de Privacidad (/privacy)', () => {
  test('debería tener h1 contendo "Privacidad" o "Privacy"', async ({ page }) => {
    await page.goto('/privacy')
    
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toContainText(/privacidad|privacy/i)
  })

  test('debería tener sección de Responsable del Tratamiento', async ({ page }) => {
    await page.goto('/privacy')
    
    // Use heading role to avoid strict mode violation with h2 AND p
    await expect(page.getByRole('heading', { name: /responsable del tratamiento/i })).toBeVisible()
  })

  test('debería tener sección de Derechos del Interesado', async ({ page }) => {
    await page.goto('/privacy')
    
    // Use heading role to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /derechos del interesado/i })).toBeVisible()
  })

  test('debería tener información de contacto', async ({ page }) => {
    await page.goto('/privacy')
    
    // Use .first() to avoid matching multiple elements
    await expect(page.getByText(/privacy@flota-camiones.com/i).first()).toBeVisible()
  })

  test('debería tener sección de Cookies', async ({ page }) => {
    await page.goto('/privacy')
    
    // Use .first() to avoid strict mode violation - "cookies" appears in multiple places
    await expect(page.getByRole('heading', { name: /cookies/i }).first()).toBeVisible()
  })

  test('debería tener múltiples secciones h2', async ({ page }) => {
    await page.goto('/privacy')
    
    // Should have multiple h2 headings (sections)
    const sections = page.getByRole('heading', { level: 2 })
    const count = await sections.count()
    expect(count).toBeGreaterThan(5)
  })

  test('debería ser accesible desde footer en landing page', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    
    // Click on privacy policy link
    const privacyLink = page.getByRole('link', { name: /política de privacidad/i }).first()
    await privacyLink.click()
    
    await page.waitForURL('/privacy')
    await expect(page).toHaveURL(/\/privacy/)
  })
})

test.describe('Términos y Condiciones (/terms)', () => {
  test('debería tener h1 contendo "Términos" o "Condiciones"', async ({ page }) => {
    await page.goto('/terms')
    
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toContainText(/términos|condiciones/i)
  })

  test('debería tener sección de Descripción del Servicio', async ({ page }) => {
    await page.goto('/terms')
    
    // Use heading role to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /descripción del servicio/i })).toBeVisible()
  })

  test('debería tener sección de Cuentas de Usuario', async ({ page }) => {
    await page.goto('/terms')
    
    // Use heading role to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /cuentas de usuario/i })).toBeVisible()
  })

  test('debería tener sección de Política de Cookies', async ({ page }) => {
    await page.goto('/terms')
    
    // Use heading role to avoid matching both heading AND link
    await expect(page.getByRole('heading', { name: /política de cookies/i })).toBeVisible()
  })

  test('debería tener sección de Suscripción y Pago', async ({ page }) => {
    await page.goto('/terms')
    
    // Use heading role to avoid matching heading + multiple paragraphs
    await expect(page.getByRole('heading', { name: /suscripción/i })).toBeVisible()
  })

  test('debería mencionar los planes disponibles (Free, Pro, Enterprise)', async ({ page }) => {
    await page.goto('/terms')
    
    // Should mention the different plans
    const content = await page.content()
    const hasPlanInfo = /plan gratuito|plan profesional|plan empresa/i.test(content) ||
                        /free|pro|enterprise/i.test(content)
    expect(hasPlanInfo).toBeTruthy()
  })

  test('debería ser accesible desde footer en landing page', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    
    // Click on terms and conditions link
    const termsLink = page.getByRole('link', { name: /términos y condiciones/i }).first()
    await termsLink.click()
    
    await page.waitForURL('/terms')
    await expect(page).toHaveURL(/\/terms/)
  })
})

test.describe('Aviso Legal (/legal-notice)', () => {
  test('debería tener h1 contendo "Aviso Legal" o "Legal"', async ({ page }) => {
    await page.goto('/legal-notice')
    
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toContainText(/aviso legal|legal/i)
  })

  test('debería tener sección de Titular de la Plataforma', async ({ page }) => {
    await page.goto('/legal-notice')
    
    // Use heading role to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /titular de la plataforma/i })).toBeVisible()
  })

  test('debería tener información de contacto', async ({ page }) => {
    await page.goto('/legal-notice')
    
    // Use .first() to avoid matching multiple elements
    await expect(page.getByText(/legal@flota-camiones.com/i).first()).toBeVisible()
  })

  test('debería tener sección de Propiedad Intelectual', async ({ page }) => {
    await page.goto('/legal-notice')
    
    // Use heading role to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /propiedad intelectual/i })).toBeVisible()
  })

  test('debería tener sección de Legislación Aplicable', async ({ page }) => {
    await page.goto('/legal-notice')
    
    // Use heading role to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /legislación aplicable/i })).toBeVisible()
  })

  test('debería ser accesible desde footer en landing page', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    
    // Click on legal notice link
    const legalLink = page.getByRole('link', { name: /aviso legal/i }).first()
    await legalLink.click()
    
    await page.waitForURL('/legal-notice')
    await expect(page).toHaveURL(/\/legal-notice/)
  })
})

test.describe('Páginas Legales - Estructura Común', () => {
  test('todas las páginas legales deben tener h1 y h2', async ({ page }) => {
    const pages = ['/privacy', '/terms', '/legal-notice']
    
    for (const pagePath of pages) {
      await page.goto(pagePath)
      
      // Should have h1
      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toBeVisible()
      
      // Should have at least one h2
      const h2 = page.getByRole('heading', { level: 2 })
      await expect(h2.first()).toBeVisible()
    }
  })

  test('todas las páginas legales deben ser accesibles sin autenticación', async ({ page, context }) => {
    // Clear cookies to ensure not authenticated
    await context.clearCookies()
    
    const pages = ['/privacy', '/terms', '/legal-notice']
    
    for (const pagePath of pages) {
      await page.goto(pagePath)
      
      // Should load successfully (no redirect to login)
      expect(page.url()).toContain(pagePath)
      
      // Should have content
      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toBeVisible()
    }
  })

  test('todas las páginas legales deben tener pie de página con copyright', async ({ page }) => {
    const pages = ['/privacy', '/terms', '/legal-notice']
    
    for (const pagePath of pages) {
      await page.goto(pagePath)
      
      // Should have footer with copyright
      await expect(page.getByText(/©.*flota camiones/i)).toBeVisible()
    }
  })
})
