import { describe, it, expect, beforeEach } from 'vitest'
import { 
  rateLimit, 
  resetRateLimit, 
  getStoreSize,
  type RateLimitConfig 
} from '@/lib/rate-limit'

describe('Rate Limit Utility', () => {
  const testConfig: RateLimitConfig = {
    window: 1000, // 1 second window for testing
    maxRequests: 3,
  }

  beforeEach(() => {
    // Reset rate limits before each test
    resetRateLimit('test-key')
    resetRateLimit('other-key')
    resetRateLimit('admin:stats:192.168.1.1')
    resetRateLimit('admin:stats:192.168.1.2')
    resetRateLimit('auth:login:10.0.0.1')
  })

  describe('rateLimit function', () => {
    it('debería permitir solicitudes dentro del límite', () => {
      const result = rateLimit('test-key', testConfig)
      
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(testConfig.maxRequests - 1)
      expect(result.resetAt).toBeGreaterThan(Date.now())
    })

    it('debería decrementar remaining con cada solicitud exitosa', () => {
      // First request
      const result1 = rateLimit('test-key', testConfig)
      expect(result1.success).toBe(true)
      expect(result1.remaining).toBe(2)

      // Second request
      const result2 = rateLimit('test-key', testConfig)
      expect(result2.success).toBe(true)
      expect(result2.remaining).toBe(1)

      // Third request
      const result3 = rateLimit('test-key', testConfig)
      expect(result3.success).toBe(true)
      expect(result3.remaining).toBe(0)
    })

    it('debería bloquear solicitudes después de exceder el límite', () => {
      // Exhaust the limit
      rateLimit('test-key', testConfig) // 1
      rateLimit('test-key', testConfig) // 2
      rateLimit('test-key', testConfig) // 3 - last allowed

      // This should be blocked
      const result = rateLimit('test-key', testConfig)
      
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.resetAt).toBeGreaterThan(Date.now())
    })

    it('debería retornar 429 Too Many Requests cuando se excede el límite', () => {
      // Exhaust the limit
      for (let i = 0; i < testConfig.maxRequests; i++) {
        rateLimit('test-key', testConfig)
      }

      const result = rateLimit('test-key', testConfig)
      expect(result.success).toBe(false)
    })
  })

  describe('diferentes keys son independientes', () => {
    it('debería permitir solicitudes independientes para diferentes keys', () => {
      // Exhaust limit for test-key
      for (let i = 0; i < testConfig.maxRequests; i++) {
        rateLimit('test-key', testConfig)
      }

      // other-key should still work
      const result = rateLimit('other-key', testConfig)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(testConfig.maxRequests - 1)
    })

    it('debería manejar diferentes IPs independientemente', () => {
      const ip1 = '192.168.1.1'
      const ip2 = '192.168.1.2'

      // Exhaust limit for ip1
      for (let i = 0; i < testConfig.maxRequests; i++) {
        rateLimit(`admin:stats:${ip1}`, testConfig)
      }

      // ip2 should still work
      const result = rateLimit(`admin:stats:${ip2}`, testConfig)
      expect(result.success).toBe(true)
    })
  })

  describe('reset del window después del tiempo', () => {
    it('debería permitir nuevas solicitudes después de que expire el window', async () => {
      const shortConfig: RateLimitConfig = {
        window: 50, // 50ms window
        maxRequests: 1,
      }

      // First request
      const result1 = rateLimit('test-key', shortConfig)
      expect(result1.success).toBe(true)

      // Second request blocked
      const result2 = rateLimit('test-key', shortConfig)
      expect(result2.success).toBe(false)

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 60))

      // Should be allowed again
      const result3 = rateLimit('test-key', shortConfig)
      expect(result3.success).toBe(true)
    })

    it('debería auto-resetear el contador después del window', async () => {
      const shortConfig: RateLimitConfig = {
        window: 50,
        maxRequests: 2,
      }

      // Use up all requests
      rateLimit('test-key', shortConfig)
      rateLimit('test-key', shortConfig)
      
      // Blocked
      const blocked = rateLimit('test-key', shortConfig)
      expect(blocked.success).toBe(false)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60))

      // Should reset and allow requests again
      const reset = rateLimit('test-key', shortConfig)
      expect(reset.success).toBe(true)
      expect(reset.remaining).toBe(1) // 2 - 1 = 1
    })
  })

  describe('auto-cleanup de entradas expiradas', () => {
    it('no debería acumular entradas expiradas en memoria', async () => {
      const shortConfig: RateLimitConfig = {
        window: 50,
        maxRequests: 1,
      }

      const keys = ['key1', 'key2', 'key3', 'key4', 'key5']
      
      // Create entries
      for (const key of keys) {
        rateLimit(key, shortConfig)
        rateLimit(key, shortConfig) // Blocked
      }

      // All should be blocked now
      const sizeBefore = getStoreSize()
      expect(sizeBefore).toBe(5)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60))

      // Access one key to trigger cleanup
      rateLimit('key1', shortConfig)

      // The store should be cleaned up
      const sizeAfter = getStoreSize()
      expect(sizeAfter).toBeLessThanOrEqual(1) // Only key1 should remain
    })
  })

  describe('resetRateLimit', () => {
    it('debería limpiar el estado de rate limit para una key específica', () => {
      // Exhaust limit
      rateLimit('test-key', testConfig)
      rateLimit('test-key', testConfig)
      rateLimit('test-key', testConfig)

      // Blocked
      const blocked = rateLimit('test-key', testConfig)
      expect(blocked.success).toBe(false)

      // Reset
      resetRateLimit('test-key')

      // Should be allowed again
      const reset = rateLimit('test-key', testConfig)
      expect(reset.success).toBe(true)
      expect(reset.remaining).toBe(testConfig.maxRequests - 1)
    })
  })

  describe('configuraciones de rate limit', () => {
    it('debería funcionar con diferentes configuraciones de window', () => {
      const config1: RateLimitConfig = { window: 1000, maxRequests: 5 }
      const config2: RateLimitConfig = { window: 60000, maxRequests: 100 }

      const result1 = rateLimit('key1', config1)
      const result2 = rateLimit('key2', config2)

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      
      // Different windows should have different reset times
      expect(result1.resetAt).toBeLessThan(result2.resetAt)
    })

    it('debería manejar límites grandes', () => {
      const largeConfig: RateLimitConfig = {
        window: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000,
      }

      const result = rateLimit('test-key', largeConfig)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(999)
    })
  })

  describe('headers de rate limit', () => {
    it('debería calcular correctamente resetAt', () => {
      const config: RateLimitConfig = {
        window: 1000,
        maxRequests: 10,
      }

      const before = Date.now()
      const result = rateLimit('test-key', config)
      const after = Date.now()

      // resetAt should be approximately now + window
      const expectedResetAt = before + config.window
      expect(result.resetAt).toBeGreaterThanOrEqual(expectedResetAt)
      expect(result.resetAt).toBeLessThanOrEqual(after + config.window)
    })
  })
})

describe('Rate Limit File Existence', () => {
  it('debería existir el archivo src/lib/rate-limit.ts', () => {
    const fs = require('fs')
    const path = require('path')
    const rateLimitPath = path.join(process.cwd(), 'src/lib/rate-limit.ts')
    expect(fs.existsSync(rateLimitPath)).toBe(true)
  })

  it('debería exportar rateLimit function', () => {
    const fs = require('fs')
    const path = require('path')
    const rateLimitPath = path.join(process.cwd(), 'src/lib/rate-limit.ts')
    const content = fs.readFileSync(rateLimitPath, 'utf-8')
    expect(content).toContain('export function rateLimit')
  })

  it('debería exportar RateLimitConfig y RateLimitResult types', () => {
    const fs = require('fs')
    const path = require('path')
    const rateLimitPath = path.join(process.cwd(), 'src/lib/rate-limit.ts')
    const content = fs.readFileSync(rateLimitPath, 'utf-8')
    expect(content).toContain('RateLimitConfig')
    expect(content).toContain('RateLimitResult')
  })
})

describe('Rate Limits Config File', () => {
  it('debería existir el archivo src/config/rate-limits.ts', () => {
    const fs = require('fs')
    const path = require('path')
    const configPath = path.join(process.cwd(), 'src/config/rate-limits.ts')
    expect(fs.existsSync(configPath)).toBe(true)
  })

  it('debería exportar ADMIN_RATE_LIMIT, AUTH_RATE_LIMIT, API_RATE_LIMIT', () => {
    const fs = require('fs')
    const path = require('path')
    const configPath = path.join(process.cwd(), 'src/config/rate-limits.ts')
    const content = fs.readFileSync(configPath, 'utf-8')
    expect(content).toContain('ADMIN_RATE_LIMIT')
    expect(content).toContain('AUTH_RATE_LIMIT')
    expect(content).toContain('API_RATE_LIMIT')
  })

  it('debería tener los valores correctos para cada límite', () => {
    const fs = require('fs')
    const path = require('path')
    const configPath = path.join(process.cwd(), 'src/config/rate-limits.ts')
    const content = fs.readFileSync(configPath, 'utf-8')
    
    // Check ADMIN_RATE_LIMIT: 100 requests per 15 minutes
    expect(content).toContain('maxRequests: 100')
    expect(content).toContain('window: 15 * 60 * 1000')
    
    // Check AUTH_RATE_LIMIT: 10 requests per 15 minutes
    expect(content).toContain('maxRequests: 10')
    
    // Check API_RATE_LIMIT: 200 requests per 15 minutes
    expect(content).toContain('maxRequests: 200')
  })
})
