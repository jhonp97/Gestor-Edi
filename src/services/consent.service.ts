import { ConsentLogRepository } from '@/repositories/consent-log.repository'
import type { ConsentCategories } from '@/schemas/consent.schema'

const consentLogRepo = new ConsentLogRepository()

export class ConsentService {
  async recordConsent(data: {
    userId?: string
    categories: ConsentCategories
    ip?: string
    userAgent?: string
    organizationId?: string
  }) {
    return consentLogRepo.create(data)
  }

  async getConsentsByOrg(organizationId: string) {
    return consentLogRepo.findByOrganizationId(organizationId)
  }

  async getConsentStats() {
    return consentLogRepo.getStats()
  }
}

export const consentService = new ConsentService()
