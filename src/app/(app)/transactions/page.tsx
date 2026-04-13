import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TransactionList } from '@/components/transactions/transaction-list'
import { TransactionForm } from '@/components/transactions/transaction-form'

// Force dynamic rendering to avoid build-time database connection
export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const session = await auth()
  if (!session?.user?.organizationId) redirect('/login')
  const orgId = session.user.organizationId

  const [transactions, trucks] = await Promise.all([
    prisma.transaction.findMany({
      where: { organizationId: orgId },
      include: { truck: true },
      orderBy: { date: 'desc' },
    }),
    prisma.truck.findMany({
      where: { organizationId: orgId },
      orderBy: { plate: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transacciones</h1>
          <p className="text-lg text-muted-foreground">
            Registro de ingresos y gastos
          </p>
        </div>
        <TransactionForm trucks={trucks} />
      </div>

      <TransactionList transactions={transactions} />
    </div>
  )
}
