import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCivilDate } from '@/lib/daily-pay'
import { madridTimestamp, recordedAmount, type loadFleetMonthlyReport } from '@/lib/truck-monthly-report'

type Report = Awaited<ReturnType<typeof loadFleetMonthlyReport>>

export function FleetMonthlyReport({ report }: { report: Report }) {
  const plates = new Map(report.trucks.map(truck => [truck.id, truck.plate]))
  return <Card>
    <CardHeader><CardTitle>Informe mensual de la flota</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <form method="get" className="flex flex-wrap items-center gap-2">
        <label htmlFor="fleet-month">Mes</label>
        <input id="fleet-month" name="month" type="month" min="1900-01" max="2199-12" defaultValue={report.month} className="rounded border px-2 py-1" />
        <label htmlFor="fleet-truck">Camión</label>
        <select id="fleet-truck" name="truck" defaultValue={report.selectedTruck} className="rounded border px-2 py-1">
          <option value="all">Todos los camiones</option>
          {report.trucks.map(truck => <option key={truck.id} value={truck.id}>{truck.plate}</option>)}
        </select>
        <button type="submit" className="rounded border px-3 py-1">Ver informe</button>
      </form>
      <p>Transacciones registradas según Europe/Madrid; jornadas según fecha civil. La empresa es solo una etiqueta descriptiva de cada jornada. Sin salarios ni ingresos inferidos. Los totales de flota y de cada camión se redondean de forma independiente desde importes registrados; no se suman cifras ya redondeadas.</p>
      <p>Ingresos registrados de la selección: €{report.totals.income}</p>
      <p>Gastos registrados de la selección: €{report.totals.expense}</p>
      <p>Jornadas únicas de trabajadores: {report.workerDays}</p>
      {report.trucks.length === 0 && <p>No hay camiones registrados en esta flota.</p>}
      <section aria-label="Totales por camión"><h3 className="font-semibold">Totales por camión</h3>
        <ul>{report.byTruck.map(truck => <li key={truck.id}>{truck.plate} · Ingresos: €{truck.totals.income} · Gastos: €{truck.totals.expense}</li>)}</ul>
      </section>
      <section aria-label="Transacciones registradas"><h3 className="font-semibold">Transacciones registradas</h3>
        {report.transactions.length === 0 ? <p>No hay transacciones registradas este mes.</p> : <ul>{report.transactions.map(row => <li key={row.id}>{plates.get(row.truckId)} · {madridTimestamp(row.date)} · {row.type === 'INCOME' ? 'Ingreso' : 'Gasto'} · {row.description}{row.category ? ` · ${row.category}` : ''} · €{recordedAmount(row.amount)}</li>)}</ul>}
      </section>
      <section aria-label="Jornadas atribuidas"><h3 className="font-semibold">Jornadas atribuidas</h3>
        {report.segments.length === 0 ? <p>No hay jornadas atribuidas este mes.</p> : <ul>{report.segments.map(segment => <li key={segment.id}>{plates.get(segment.truckId)} · {formatCivilDate(segment.workDate)} · {segment.operation.companyName} · {segment.operation.dailyPayDay.worker.name} · {segment.share}%{segment.kilometers !== null ? ` · ${segment.kilometers.toString()} km` : ''}{segment.incident ? ` · Incidencia: ${segment.incident}` : ''}</li>)}</ul>}
      </section>
    </CardContent>
  </Card>
}
