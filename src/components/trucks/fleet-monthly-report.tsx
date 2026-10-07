import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCivilDate } from '@/lib/daily-pay'
import { madridTimestamp, recordedAmount, type loadFleetMonthlyReport } from '@/lib/truck-monthly-report'

import { ReportDetailNavigation } from '@/components/trucks/truck-monthly-report'

type Report = Awaited<ReturnType<typeof loadFleetMonthlyReport>>

export function FleetMonthlyReport({ report }: { report: Report }) {
  const filters = { month: report.month, period: report.period, truck: report.selectedTruck, transactionsCursor: report.pages.transactions.current, segmentsCursor: report.pages.segments.current }
  const plates = new Map(report.trucks.map(truck => [truck.id, truck.plate]))
  const [year, month] = report.month.split('-').map(Number)
  const periodLabel = report.period === 'year' ? `Año ${year}`
    : report.period === 'half-year' ? `Semestre ${Math.ceil(month / 6)} de ${year}`
      : report.period === 'quarter' ? `Trimestre ${Math.ceil(month / 3)} de ${year}`
        : `Mes ${report.month}`
  return <Card>
    <CardHeader><CardTitle>Informe de la flota</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <form method="get" className="flex flex-wrap items-center gap-2">
        <label htmlFor="fleet-month">Mes de referencia</label>
        <input id="fleet-month" name="month" type="month" min="1900-01" max="2199-12" defaultValue={report.month} className="rounded border px-2 py-1" />
        <label htmlFor="fleet-period">Período</label>
        <select id="fleet-period" name="period" defaultValue={report.period} className="rounded border px-2 py-1">
          <option value="month">Mes</option><option value="quarter">Trimestre</option><option value="half-year">Semestre</option><option value="year">Año</option>
        </select>
        <label htmlFor="fleet-truck">Camión</label>
        <select id="fleet-truck" name="truck" defaultValue={report.selectedTruck} className="rounded border px-2 py-1">
          <option value="all">Todos los camiones</option>
          {report.trucks.map(truck => <option key={truck.id} value={truck.id}>{truck.plate}</option>)}
        </select>
        <button type="submit" className="rounded border px-3 py-1">Ver informe</button>
      </form>
      {report.period === 'month' && <a className="inline-block rounded border px-3 py-2" href={`/api/trucks/report/pdf?${new URLSearchParams({ month: report.month, period: 'month', truck: report.selectedTruck })}`}>Descargar PDF mensual</a>}
      <p>Transacciones registradas según Europe/Madrid; jornadas según fecha civil. La empresa es solo una etiqueta descriptiva de cada jornada. Sin salarios ni ingresos inferidos. Los totales de flota y de cada camión se redondean de forma independiente desde importes registrados; no se suman cifras ya redondeadas.</p>
      <p>{periodLabel}</p>
      <p>Ingresos registrados de la selección: €{report.totals.income}</p>
      <p>Gastos registrados de la selección: €{report.totals.expense}</p>
      <p>Jornadas únicas de trabajadores: {report.workerDays}</p>
      {report.trucks.length === 0 && <p>No hay camiones registrados en esta flota.</p>}
      <section aria-label="Totales por camión"><h3 className="font-semibold">Totales por camión</h3>
        <ul>{report.byTruck.map(truck => <li key={truck.id}>{truck.plate} · Ingresos: €{truck.totals.income} · Gastos: €{truck.totals.expense}</li>)}</ul>
      </section>
      {report.period === 'month' ? <><section aria-label="Transacciones registradas"><h3 className="font-semibold">Transacciones registradas</h3>
        {report.transactions.length === 0 ? <p>No hay transacciones registradas este mes.</p> : <ul>{report.transactions.map(row => <li key={row.id}>{plates.get(row.truckId)} · {madridTimestamp(row.date)} · {row.type === 'INCOME' ? 'Ingreso' : 'Gasto'} · {row.description}{row.category ? ` · ${row.category}` : ''} · €{recordedAmount(row.amount)}</li>)}</ul>}
        <ReportDetailNavigation label="transacciones" page={report.pages.transactions} parameter="transactionsCursor" filters={filters} />
      </section>
      <section aria-label="Jornadas atribuidas"><h3 className="font-semibold">Jornadas atribuidas</h3>
        {report.segments.length === 0 ? <p>No hay jornadas atribuidas este mes.</p> : <ul>{report.segments.map(segment => <li key={segment.id}>{plates.get(segment.truckId)} · {formatCivilDate(segment.workDate)} · {segment.operation.companyName} · {segment.operation.dailyPayDay.worker.name} · {segment.share}%{segment.kilometers !== null ? ` · ${segment.kilometers.toString()} km` : ''}{segment.incident ? ` · Incidencia: ${segment.incident}` : ''}</li>)}</ul>}
        <ReportDetailNavigation label="jornadas" page={report.pages.segments} parameter="segmentsCursor" filters={filters} />
      </section></> : <p>Período agregado: solo totales y jornadas únicas; sin filas de detalle.</p>}
    </CardContent>
  </Card>
}
