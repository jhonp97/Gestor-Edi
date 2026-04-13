import { prisma } from '@/lib/prisma'
import { getEncryptionService } from '@/services/encryption.service'

export interface DataExportFormat {
  organization: {
    id: string
    name: string
    createdAt: string
  }
  users: Array<{
    id: string
    name: string
    email: string
    role: string
    createdAt: string
  }>
  trucks: Array<{
    id: string
    plate: string
    brand: string
    model: string
    year: number
    status: string
    createdAt: string
  }>
  transactions: Array<{
    id: string
    truckId: string | null
    type: string
    amount: number
    description: string
    date: string
    category: string | null
    createdAt: string
  }>
  workers: Array<{
    id: string
    name: string
    dni: string
    position: string
    baseSalary: number
    status: string
    createdAt: string
  }>
  payrolls: Array<{
    id: string
    workerId: string
    month: number
    year: number
    baseSalary: number
    grossPay: number
    netPay: number
    createdAt: string
  }>
  _meta: {
    exportedAt: string
    securityWarning: string
  }
}

export class DataExportService {
  private encryption = getEncryptionService()

  async generateExport(orgId: string, format: 'json' | 'csv' = 'json'): Promise<DataExportFormat> {
    // Fetch all org data
    const [organization, users, trucks, transactions, workers, payrolls] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.user.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      prisma.truck.findMany({
        where: { organizationId: orgId },
        select: { id: true, plate: true, brand: true, model: true, year: true, status: true, createdAt: true },
      }),
      prisma.transaction.findMany({
        where: { organizationId: orgId },
        select: { id: true, truckId: true, type: true, amount: true, description: true, date: true, category: true, createdAt: true },
      }),
      prisma.worker.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, dni: true, position: true, baseSalary: true, status: true, createdAt: true },
      }),
      prisma.payroll.findMany({
        where: { organizationId: orgId },
        select: { id: true, workerId: true, month: true, year: true, baseSalary: true, grossPay: true, netPay: true, createdAt: true },
      }),
    ])

    if (!organization) {
      throw new Error('Organización no encontrada')
    }

    // Decrypt DNI for each worker (user's own data)
    const workersWithDecryptedDni = await Promise.all(
      workers.map(async worker => ({
        ...worker,
        // DNI is stored encrypted - decrypt it for the export
        dni: worker.dni ? await this.encryption.decryptWorkerDni(worker.dni) : '',
      }))
    )

    const exportData: DataExportFormat = {
      organization: {
        id: organization.id,
        name: organization.name,
        createdAt: organization.createdAt.toISOString(),
      },
      users: users.map(u => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
      trucks: trucks.map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      })),
      transactions: transactions.map(tx => ({
        ...tx,
        date: tx.date.toISOString(),
        createdAt: tx.createdAt.toISOString(),
      })),
      workers: workersWithDecryptedDni.map(w => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
      })),
      payrolls: payrolls.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
      _meta: {
        exportedAt: new Date().toISOString(),
        securityWarning: 'AVISO DE SEGURIDAD: Este archivo contiene datos personales sensibles (DNI) que han sido descifrados para su exportación. Trate esta información con extrema confidencialidad. De acuerdo con el RGPD (UE) 2016/679 y la LOPDGDD (ES), usted es responsable de proteger estos datos. No comparta este archivo sin las medidas de seguridad apropiadas.',
      },
    }

    return exportData
  }
}

export const dataExportService = new DataExportService()
