'use client'

import { useMemo } from 'react'

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PAID: 'bg-green-100 text-green-800 border-green-200',
}

export interface HistoryMonth {
  periodStart: string
  status: 'PENDING' | 'PAID'
  paidAt: string | null
  accrued: string
}

interface DailyPayCalendarProps {
  months: HistoryMonth[]
  selectedPeriodStart: string
  year: number
  onSelectMonth: (periodStart: string) => void
  onPrevYear: () => void
  onNextYear: () => void
}

export function DailyPayCalendar({
  months,
  selectedPeriodStart,
  year,
  onSelectMonth,
  onPrevYear,
  onNextYear,
}: DailyPayCalendarProps) {
  const grid = useMemo(() => {
    const byPeriod = new Map<string, HistoryMonth>()
    for (const m of months) byPeriod.set(m.periodStart, m)
    return Array.from({ length: 12 }, (_, i) => {
      const ps = `${year}-${String(i + 1).padStart(2, '0')}-01`
      return byPeriod.get(ps) ?? {
        periodStart: ps,
        status: 'PENDING' as const,
        paidAt: null,
        accrued: '0.00',
      }
    })
  }, [months, year])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevYear}
          className="rounded border px-2 py-1 text-sm hover:bg-muted"
          aria-label={`Año anterior ${year - 1}`}
        >
          ←
        </button>
        <span className="text-sm font-semibold">{year}</span>
        <button
          type="button"
          onClick={onNextYear}
          className="rounded border px-2 py-1 text-sm hover:bg-muted"
          aria-label={`Año siguiente ${year + 1}`}
        >
          →
        </button>
      </div>

      <div
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        role="grid"
        aria-label={`Calendario de pago diario ${year}`}
      >
        {grid.map((m, i) => (
          <button
            key={m.periodStart}
            type="button"
            onClick={() => onSelectMonth(m.periodStart)}
            className={`rounded border p-2 text-left text-xs transition-colors ${
              m.periodStart === selectedPeriodStart
                ? 'border-primary ring-1 ring-primary'
                : 'border-border hover:border-primary/50'
            }`}
            aria-label={`${MONTH_NAMES[i]} ${year} — ${m.status === 'PAID' ? 'Pagado' : 'Pendiente'} — ${m.accrued}`}
            aria-pressed={m.periodStart === selectedPeriodStart}
          >
            <div className="font-medium">{MONTH_NAMES[i]}</div>
            <div className={`mt-1 inline-block rounded px-1 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[m.status]}`}>
              {m.status === 'PAID' ? 'Pagado' : 'Pendiente'}
            </div>
            <div className="mt-1 text-muted-foreground">{m.accrued}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
