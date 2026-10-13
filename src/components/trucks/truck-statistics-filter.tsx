'use client'

import { useId, useState } from 'react'
import type { TruckStatisticsPeriod } from '@/lib/truck-statistics-period'

const statisticsKeys = new Set(['statsPeriod', 'statsMonth', 'statsFrom', 'statsTo'])
const fieldClass = 'min-w-0 rounded-md border bg-background px-3 py-2 text-sm'

export function TruckStatisticsFilter({ period, preservedParams = {} }: {
  period: TruckStatisticsPeriod
  preservedParams?: Record<string, string | string[] | undefined>
}) {
  const id = useId()
  const [mode, setMode] = useState(period.mode)
  const [from, setFrom] = useState(period.from)
  const [to, setTo] = useState(period.to)

  return (
    <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filtrar estadísticas">
      {Object.entries(preservedParams).filter(([key]) => !statisticsKeys.has(key)).flatMap(([key, value]) =>
        (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((entry, index) =>
          <input key={`${key}-${index}`} type="hidden" name={key} value={entry} />
        )
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={`${id}-mode`}>Período de estadísticas</label>
        <select id={`${id}-mode`} name="statsPeriod" className={fieldClass} value={mode} onChange={event => setMode(event.target.value as TruckStatisticsPeriod['mode'])}>
          <option value="current">Mes actual</option>
          <option value="month">Mes elegido</option>
          <option value="all">Total histórico</option>
          <option value="range">Desde-Hasta</option>
        </select>
      </div>
      {mode === 'month' && <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={`${id}-month`}>Mes de estadísticas</label>
        <input id={`${id}-month`} className={fieldClass} type="month" name="statsMonth" defaultValue={period.month} min="1900-01" max="2199-12" required />
      </div>}
      {mode === 'range' && <>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-from`}>Desde</label>
          <input id={`${id}-from`} className={fieldClass} type="date" name="statsFrom" value={from} onChange={event => setFrom(event.target.value)} min="1900-01-01" max={to || '2199-12-31'} required />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-to`}>Hasta</label>
          <input id={`${id}-to`} className={fieldClass} type="date" name="statsTo" value={to} onChange={event => setTo(event.target.value)} min={from || '1900-01-01'} max="2199-12-31" required />
        </div>
      </>}
      <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Aplicar</button>
    </form>
  )
}
