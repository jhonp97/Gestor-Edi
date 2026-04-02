import { prisma } from '@/lib/prisma'
import { TransactionList } from '@/components/transactions/transaction-list'
import { TransactionForm } from '@/components/transactions/transaction-form'

export default async function TransactionsPage() {
  const [transactions, trucks] = await Promise.all([
    prisma.transaction.findMany({
      include: { truck: true },
      orderBy: { date: 'desc' },
    }),
    prisma.truck.findMany({
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
