'use client'

import { useState } from 'react'
import type { FleetGlobalPeriod } from '@/lib/fleet-global-report-types'

export function FleetGlobalReportForm({ trucks, month, period }: { trucks: { id: string; plate: string }[]; month: string; period: FleetGlobalPeriod }) {
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  return <section aria-labelledby="global-report-title" className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-3">
    <div><h3 id="global-report-title" className="text-lg font-semibold text-slate-900">Resumen global de flota</h3>
      <p className="text-sm text-slate-600">Elige varios camiones para reunir actividad, trabajadores, empresas y gasto en combustible en un PDF.</p></div>
    <form action="/api/trucks/report/global/pdf" method="get" className="space-y-3" aria-busy={loading} onSubmit={async event => {
      event.preventDefault()
      if (loading || selected.length === 0) return
      const query = new URLSearchParams()
      new FormData(event.currentTarget).forEach((value, key) => query.append(key, String(value)))
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/trucks/report/global/pdf?${query}`)
        if (!response.ok) throw new Error('download')
        const url = URL.createObjectURL(await response.blob())
        const link = document.createElement('a')
        link.href = url
        link.download = `resumen-flota-${query.get('month')}-${query.get('period')}.pdf`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch {
        setError('No se pudo descargar el resumen. Revisa la selección y vuelve a intentarlo.')
      } finally { setLoading(false) }
    }}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="global-month">Mes del resumen</label>
        <input id="global-month" name="month" type="month" required min="1900-01" max="2199-12" defaultValue={month} className="rounded border bg-white px-2 py-1" />
        <label htmlFor="global-period">Período del resumen</label>
        <select id="global-period" name="period" defaultValue={period} className="rounded border bg-white px-2 py-1"><option value="month">Mes</option><option value="quarter">Trimestre</option><option value="half-year">Semestre</option><option value="year">Año</option></select>
      </div>
      <fieldset className="space-y-2"><legend className="font-medium">Camiones incluidos</legend>
        <div className="flex flex-wrap gap-3 text-sm"><button type="button" onClick={() => setSelected(trucks.map(truck => truck.id))} className="underline">Seleccionar todos</button><button type="button" onClick={() => setSelected([])} className="underline">Limpiar selección</button></div>
        <div className="flex max-h-48 flex-wrap gap-2 overflow-auto">{trucks.map(truck => <label key={truck.id} className="flex items-center gap-2 rounded border bg-white px-3 py-2"><input type="checkbox" name="truck" value={truck.id} checked={selected.includes(truck.id)} onChange={event => setSelected(current => event.target.checked ? [...current, truck.id] : current.filter(id => id !== truck.id))} />{truck.plate}</label>)}</div>
        {trucks.length === 0 && <p>No hay camiones disponibles.</p>}
      </fieldset>
      <p role="status" aria-live="polite" className="text-sm">{selected.length} camiones seleccionados{loading ? ' · Preparando PDF…' : ''}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={selected.length === 0 || loading} className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">Descargar resumen global</button>
      <p className="text-xs text-slate-600">Descarga directa. El combustible corresponde a toda la selección, no a empresas concretas. Sin actividad registrada no significa inactividad; 0 € registrado no demuestra ausencia de consumo.</p>
    </form>
  </section>
}
