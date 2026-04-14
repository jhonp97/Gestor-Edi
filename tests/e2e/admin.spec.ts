import { test, expect } from '@playwright/test'

/**
 * Admin route protection tests
 * 
 * These tests verify that admin routes are properly protected and that
 * ORG_ADMIN users cannot access admin functionality.
 * 
 * Note: We test that ORG_ADMIN cannot access admin routes, since the
 * PLATFORM_ADMIN user requires Google OAuth which cannot be automated.
 */

// Helper function to login via API and set auth cookie
async function loginAsAdmin(page: any) {
  // Use API to login and get auth cookie
  const response = await page.request.post('/api/auth/login', {
    data: {
      email: 'admin@flota.com',
      password: 'admin123'
    }
  })
  
  // The API should return success
  expect([200, 302]).toContain(response.status())
  
  // Navigate to dashboard to establish session
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
}

test.describe('Admin Route Protection - API Level', () => {
  test('ORG_ADMIN no debería poder acceder a /api/admin/stats', async ({ page }) => {
    // Login first
    await loginAsAdmin(page)
    
    // Try to access admin API directly - should return 403
    const response = await page.request.get('/api/admin/stats')
    
    // Should return 403 (Forbidden) since ORG_ADMIN is not PLATFORM_ADMIN
    expect(response.status()).toBe(403)
  })

  test('ORG_ADMIN no debería poder acceder a /api/admin/orgs', async ({ page }) => {
    // Login first
    await loginAsAdmin(page)
    
    // Try to access admin orgs API
    const response = await page.request.get('/api/admin/orgs')
    
    // Should return 403 (Forbidden)
    expect(response.status()).toBe(403)
  })

  test('ORG_ADMIN no debería poder acceder a /api/admin/users', async ({ page }) => {
    // Login first
    await loginAsAdmin(page)
    
    // Try to access admin users API
    const response = await page.request.get('/api/admin/users')
    
    // Should return 403 (Forbidden)
    expect(response.status()).toBe(403)
  })
})

test.describe('Unauthenticated Admin Access', () => {
  test('debería retornar 401 o 403 para /api/admin/stats sin autenticación', async ({ page, context }) => {
    // Clear cookies to ensure not authenticated
    await context.clearCookies()
    
    const response = await page.request.get('/api/admin/stats')
    
    // Should return 401 (Unauthorized) or 403 (Forbidden)
    expect([401, 403]).toContain(response.status())
  })

  test('debería retornar 401 o 403 para /api/admin/orgs sin autenticación', async ({ page, context }) => {
    // Clear cookies to ensure not authenticated
    await context.clearCookies()
    
    const response = await page.request.get('/api/admin/orgs')
    
    // Should return 401 (Unauthorized) or 403 (Forbidden)
    expect([401, 403]).toContain(response.status())
  })

  test('debería retornar 401 o 403 para /api/admin/users sin autenticación', async ({ page, context }) => {
    // Clear cookies to ensure not authenticated
    await context.clearCookies()
    
    const response = await page.request.get('/api/admin/users')
    
    // Should return 401 (Unauthorized) or 403 (Forbidden)
    expect([401, 403]).toContain(response.status())
  })
})
