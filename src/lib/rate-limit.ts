/**
 * Rate limiting utility using in-memory sliding window algorithm.
 * 
 * NOTE: This is an in-memory implementation that resets on server restart.
 * For production scaling across multiple instances, consider using Redis.
 * @see design: Decision "Rate Limiting Strategy"
 */

export interface RateLimitConfig {
  /** Time window in milliseconds */
  window: number
  /** Maximum requests allowed within the window */
  maxRequests: number
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean
  /** Remaining requests in current window */
  remaining: number
  /** Unix timestamp when the window resets */
  resetAt: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store for rate limiting
// Maps key -> { count, resetAt }
const store = new Map<string, RateLimitEntry>()

/**
 * Apply rate limiting to a request.
 * 
 * @param key - Unique identifier for the rate limit bucket (e.g., IP + route)
 * @param config - Rate limit configuration
 * @returns Rate limit result indicating if request is allowed
 */
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()

  // Clean up expired entries to prevent memory leaks
  cleanupExpiredEntries(now)

  const entry = store.get(key)

  // No entry exists or window has expired
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.window })
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.window,
    }
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  // Increment counter
  entry.count++
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Clean up expired entries from the store.
 * Called on every rate limit check to prevent memory leaks.
 */
function cleanupExpiredEntries(now: number): void {
  for (const [k, v] of store) {
    if (v.resetAt <= now) {
      store.delete(k)
    }
  }
}

/**
 * Get the current store size (for monitoring/testing).
 */
export function getStoreSize(): number {
  return store.size
}

/**
 * Reset rate limit for a specific key.
 * Useful for testing.
 */
export function resetRateLimit(key: string): void {
  store.delete(key)
}
