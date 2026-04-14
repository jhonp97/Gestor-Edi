/**
 * Rate limit configurations for different route types.
 * 
 * Time windows are in milliseconds (15 minutes = 900000ms)
 * @see design: Decision "Rate Limit Tiers"
 */

import type { RateLimitConfig } from '@/lib/rate-limit'

/**
 * Admin API routes - Higher limits for platform administration
 * 100 requests per 15 minutes
 */
export const ADMIN_RATE_LIMIT: RateLimitConfig = {
  window: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
}

/**
 * Authentication routes - Stricter limits to prevent brute force
 * 10 requests per 15 minutes (login, register, password reset)
 */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  window: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
}

/**
 * Standard API routes - Normal limits for CRUD operations
 * 200 requests per 15 minutes
 */
export const API_RATE_LIMIT: RateLimitConfig = {
  window: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200,
}
