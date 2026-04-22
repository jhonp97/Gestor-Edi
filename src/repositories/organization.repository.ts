import { BaseRepository } from './base.repository'
import type { Organization } from '@prisma/client'

export class OrganizationRepository extends BaseRepository {
  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } })
  }

  async create(data: { name: string; ownerId: string }): Promise<Organization> {
    return this.prisma.organization.create({ data })
  }

  async findByOwnerId(ownerId: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { ownerId } })
  }

  async update(id: string, data: Partial<Organization>): Promise<Organization> {
    return this.prisma.organization.update({ where: { id }, data })
  }
}
