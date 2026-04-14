/**
 * Plan Service — subscription limit enforcement.
 * Enforces plan limits at the repository layer by checking current resource counts
 * against the organization's plan type before create operations.
 * @see design: Decision "Plan Limit Enforcement"
 */
import { prisma } from '@/lib/prisma'
import { getPlanLimits, isWithinLimit } from '@/config/plans'
import { PlanLimitError } from '@/lib/errors'
import type { PlanType } from '@/config/plans'

export class PlanService {
  /**
   * Get plan configuration (limits) for a given plan type.
   */
  getPlanConfig(planType: PlanType) {
    return getPlanLimits(planType)
  }

  /**
   * Check if an organization can create a new resource of the given type.
   * Fetches the organization's plan type, counts current resources,
   * and throws PlanLimitError if the limit is exceeded.
   *
   * @throws PlanLimitError if the resource limit is exceeded
   */
  async checkLimit(orgId: string, resource: 'workers' | 'trucks' | 'transactions'): Promise<void> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) {
      throw new Error('Organization not found')
    }

    const planType = org.planType as PlanType
    const limits = getPlanLimits(planType)

    // Count current resources for this organization
    let currentCount: number
    switch (resource) {
      case 'workers':
        currentCount = await prisma.worker.count({ where: { organizationId: orgId } })
        break
      case 'trucks':
        currentCount = await prisma.truck.count({ where: { organizationId: orgId } })
        break
      case 'transactions':
        currentCount = await prisma.transaction.count({ where: { organizationId: orgId } })
        break
    }

    if (!isWithinLimit(currentCount, planType, resource)) {
      throw new PlanLimitError(resource, limits[resource], planType)
    }
  }
}
