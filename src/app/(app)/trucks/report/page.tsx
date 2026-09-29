import { getSessionUniversal } from '@/lib/session'
import { notFound, redirect } from 'next/navigation'
import { InvalidFleetSelectionError, loadFleetMonthlyReport, resolveReportMonth, resolveReportPeriod } from '@/lib/truck-monthly-report'
import { FleetMonthlyReport } from '@/components/trucks/fleet-monthly-report'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function FleetMonthlyReportPage({ searchParams }: { searchParams: Promise<{ month?: string | string[]; truck?: string | string[]; period?: string | string[] }> }) {
  const session = await getSessionUniversal()
  if (!session?.user?.organizationId) redirect('/login')
  const { month, truck, period } = await searchParams
  let reportMonth: string
  let reportPeriod: ReturnType<typeof resolveReportPeriod>
  if (truck !== undefined && (typeof truck !== 'string' || (truck !== 'all' && !/^[\w-]+$/.test(truck)))) notFound()
  try {
    reportMonth = resolveReportMonth(month)
    reportPeriod = resolveReportPeriod(period)
  } catch {
    notFound()
  }
  let report: Awaited<ReturnType<typeof loadFleetMonthlyReport>>
  try {
    report = await loadFleetMonthlyReport(session.user.organizationId, truck ?? 'all', reportMonth, reportPeriod)
  } catch (error) {
    if (error instanceof InvalidFleetSelectionError) notFound()
    throw error
  }
  return <main className="space-y-4"><Link href="/trucks">Volver a camiones</Link><FleetMonthlyReport report={report} /></main>
}
