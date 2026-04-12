import { OrganizationRepository } from '@/repositories/organization.repository'

export class OrganizationService {
  constructor(private repo: OrganizationRepository) {}

  async getById(id: string) {
    return this.repo.findById(id)
  }

  async create(name: string, ownerId: string) {
    return this.repo.create({ name, ownerId })
  }

  async getByOwnerId(ownerId: string) {
    return this.repo.findByOwnerId(ownerId)
  }
}
