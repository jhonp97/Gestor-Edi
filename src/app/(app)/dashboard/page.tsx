import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SummaryCard } from '@/components/dashboard/summary-card'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { IncomeExpenseChart } from '@/components/dashboard/income-expense-chart'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { Card } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react'

// Force dynamic rendering to avoid database access during build
export const dynamic = 'force-dynamic'

async function getMonthlyData(orgId: string) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const currentYear = new Date().getFullYear()

  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId: orgId,
      date: {
        gte: new Date(currentYear, 0, 1),
        lte: new Date(currentYear, 11, 31),
      },
    },
  })

  const monthlyData = months.map((month, index) => {
    const monthTx = transactions.filter(
      (t) => new Date(t.date).getMonth() === index,
    )
    const income = monthTx
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0)
    const expense = monthTx
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0)

    return { month, income, expense }
  })

  return monthlyData
}

async function getCategoryData(orgId: string) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const expenses = await prisma.transaction.findMany({
    where: {
      organizationId: orgId,
      type: 'EXPENSE',
      date: { gte: startOfMonth },
    },
  })

  const categoryMap = new Map<string, number>()
  expenses.forEach((tx) => {
    const category = tx.category || 'Sin categoría'
    categoryMap.set(category, (categoryMap.get(category) || 0) + tx.amount)
  })

  return Array.from(categoryMap.entries()).map(([category, value]) => ({
    category,
    value,
  }))
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.organizationId) redirect('/login')
  const orgId = session.user.organizationId

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const endOfMonth = new Date()
  endOfMonth.setHours(23, 59, 59, 999)

  const [transactions, totalIncome, totalExpenses, totalCount, monthlyData, categoryData] =
    await Promise.all([
      prisma.transaction.findMany({
        where: {
          organizationId: orgId,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        include: { truck: true },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      prisma.transaction.aggregate({
        where: { organizationId: orgId, type: 'INCOME', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { organizationId: orgId, type: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: { organizationId: orgId, date: { gte: startOfMonth, lte: endOfMonth } },
      }),
      getMonthlyData(orgId),
      getCategoryData(orgId),
    ])

  const income = totalIncome._sum.amount ?? 0
  const expenses = totalExpenses._sum.amount ?? 0
  const netProfit = income - expenses

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Panel de Control
        </h1>
        <p className="text-lg text-muted-foreground">
          Resumen del mes actual
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Ingresos"
          value={`$${income.toFixed(2)}`}
          icon={TrendingUp}
          variant="income"
        />
        <SummaryCard
          title="Total Gastos"
          value={`$${expenses.toFixed(2)}`}
          icon={TrendingDown}
          variant="expense"
        />
        <SummaryCard
          title="Beneficio Neto"
          value={`$${netProfit.toFixed(2)}`}
          icon={DollarSign}
          variant="profit"
        />
        <SummaryCard
          title="Transacciones"
          value={String(totalCount)}
          icon={BarChart3}
          variant="default"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-xl border-0 bg-card p-4 shadow-[0_1px_3px_0_rgb(0_0_0/0.1)]">
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            Ingresos vs Gastos Mensual
          </h3>
          <IncomeExpenseChart data={monthlyData} />
        </Card>
        <Card className="rounded-xl border-0 bg-card p-4 shadow-[0_1px_3px_0_rgb(0_0_0/0.1)]">
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            Gastos por Categoría
          </h3>
          <CategoryChart data={categoryData} />
        </Card>
      </div>

      {/* Recent Transactions */}
      <RecentTransactions transactions={transactions} />
    </div>
  )
}
