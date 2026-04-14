/**
 * Plan configuration for subscription-ready architecture.
 * Limits are enforced at the repository layer.
 * @see design: Decision "Plan Limit Enforcement"
 */

export const PlanType = {
  FREE: 'FREE',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
} as const

export type PlanType = typeof PlanType[keyof typeof PlanType]

export const RESOURCE_TYPES = {
  WORKERS: 'workers',
  TRUCKS: 'trucks',
  TRANSACTIONS: 'transactions',
} as const

export type ResourceType = typeof RESOURCE_TYPES[keyof typeof RESOURCE_TYPES]

export type PlanLimits = {
  trucks: number
  workers: number
  transactions: number
  orgs: number
}

/**
 * Plan limits: FREE (5 trucks, 10 workers, 100 tx), PRO (50 trucks, 100 workers, unlimited),
 * ENTERPRISE (unlimited all).
 */
export const PLANS: Record<PlanType, PlanLimits> = {
  FREE: {
    trucks: 5,
    workers: 10,
    transactions: 100,
    orgs: 1,
  },
  PRO: {
    trucks: 50,
    workers: 100,
    transactions: Infinity,
    orgs: 1,
  },
  ENTERPRISE: {
    trucks: Infinity,
    workers: Infinity,
    transactions: Infinity,
    orgs: Infinity,
  },
}

/**
 * Get plan limits by plan type.
 */
export function getPlanLimits(planType: PlanType): PlanLimits {
  return PLANS[planType]
}

/**
 * Check if a resource count is within the plan limit.
 * Returns true if unlimited (Infinity) or if count < limit.
 */
export function isWithinLimit(currentCount: number, planType: PlanType, resource: ResourceType): boolean {
  const limits = PLANS[planType]
  const limit = limits[resource]
  if (limit === Infinity) return true
  return currentCount < limit
}
