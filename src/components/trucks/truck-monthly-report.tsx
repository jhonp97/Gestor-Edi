import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { madridTimestamp, recordedAmount, type loadTruckMonthlyReport } from '@/lib/truck-monthly-report'
import { formatCivilDate } from '@/lib/daily-pay'

type Report = Awaited<ReturnType<typeof loadTruckMonthlyReport>>

export function TruckMonthlyReport({ report, type, sort }: { report: Report; type: string; sort: string }) {
  return <Card>
    <CardHeader><CardTitle>Informe mensual del camión</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <form method="get" className="flex items-center gap-2">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="sort" value={sort} />
        <label htmlFor="report-month">Mes</label>
        <input id="report-month" name="month" type="month" min="1900-01" max="2199-12" defaultValue={report.month} className="rounded border px-2 py-1" />
        <button type="submit" className="rounded border px-3 py-1">Ver informe</button>
      </form>
      <p className="text-sm text-muted-foreground">Transacciones según Europe/Madrid; jornadas según fecha civil registrada. Solo importes efectivamente registrados; sin salarios ni ingresos inferidos. Si un importe tiene fracciones de céntimo, la fila conserva su precisión y el total se redondea a dos decimales.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <p>Ingresos registrados del mes: €{report.totals.income}</p>
        <p>Gastos registrados del mes: €{report.totals.expense}</p>
      </div>
      <section aria-label="Transacciones registradas">
        <h3 className="font-semibold">Transacciones registradas</h3>
        {report.transactions.length === 0 ? <p>No hay transacciones registradas este mes.</p> : <ul className="divide-y">{report.transactions.map(row => <li key={row.id} className="py-2">{madridTimestamp(row.date)} · {row.type === 'INCOME' ? 'Ingreso' : 'Gasto'} · {row.description}{row.category ? ` · ${row.category}` : ''} · €{recordedAmount(row.amount)}</li>)}</ul>}
      </section>
      <section aria-label="Jornadas atribuidas">
        <h3 className="font-semibold">Jornadas atribuidas al camión</h3>
        {report.segments.length === 0 ? <p>No hay jornadas atribuidas este mes.</p> : <ul className="divide-y">{report.segments.map(segment => <li key={segment.id} className="py-2">{formatCivilDate(segment.workDate)} · {segment.operation.companyName} · {segment.operation.dailyPayDay.worker.name} · {segment.share}%{segment.kilometers !== null ? ` · ${segment.kilometers.toString()} km` : ''}{segment.incident ? ` · Incidencia: ${segment.incident}` : ''}</li>)}</ul>}
      </section>
    </CardContent>
  </Card>
}
