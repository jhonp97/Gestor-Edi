import { prisma } from '@/lib/prisma'
import { PayrollTable } from '@/components/nomina/payroll-table'
import { PayrollSummaryCard } from '@/components/nomina/payroll-summary'
import { Button } from '@/components/ui/button'
import { Plus, DollarSign, TrendingDown, Wallet, Users } from 'lucide-react'
import { PayrollIndividualDialog } from '@/components/nomina/payroll-individual-dialog'
import Link from 'next/link'

// Force dynamic rendering to avoid build-time database connection
export const dynamic = 'force-dynamic'

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const params = await searchParams
  const month = params.month ? parseInt(params.month) : new Date().getMonth() + 1
  const year = params.year ? parseInt(params.year) : new Date().getFullYear()

  const [payrolls, summary] = await Promise.all([
    prisma.payroll.findMany({
      where: { month, year },
      include: { worker: true },
      orderBy: { worker: { name: 'asc' } },
    }),
    prisma.payroll.aggregate({
      where: { month, year },
      _sum: {
        grossPay: true,
        netPay: true,
        irpfAmount: true,
        socialSecurityAmount: true,
        otherDeductions: true,
      },
      _count: {
        workerId: true,
      },
    }),
  ])

  const totalGross = summary._sum.grossPay ?? 0
  const totalNet = summary._sum.netPay ?? 0
  const totalDeductions = totalGross - totalNet
  const workerCount = summary._count.workerId

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nómina</h1>
          <p className="text-lg text-muted-foreground">
            {MONTH_NAMES[month]} {year}
          </p>
        </div>
        <div className="flex gap-3">
          <PayrollIndividualDialog />
          <Link href="/nomina/generar">
            <Button size="lg">
              <Plus className="mr-2 size-5" />
              Todos los trabajadores
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <form className="flex items-center gap-3">
          <select
            name="month"
            defaultValue={month}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {MONTH_NAMES.map((name, i) =>
              i > 0 ? (
                <option key={i} value={i}>
                  {name}
                </option>
              ) : null,
            )}
          </select>
          <select
            name="year"
            defaultValue={year}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Array.from({ length: 7 }, (_, i) => 2024 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </form>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <PayrollSummaryCard
          title="Total Bruto"
          value={`$${totalGross.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="size-5" />}
        />
        <PayrollSummaryCard
          title="Total Deducciones"
          value={`$${totalDeductions.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
          icon={<TrendingDown className="size-5" />}
        />
        <PayrollSummaryCard
          title="Total Neto"
          value={`$${totalNet.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
          icon={<Wallet className="size-5" />}
        />
        <PayrollSummaryCard
          title="Nº Trabajadores"
          value={workerCount.toString()}
          icon={<Users className="size-5" />}
        />
      </div>

      {/* Table */}
      <PayrollTable payrolls={payrolls} />
    </div>
  )
}
