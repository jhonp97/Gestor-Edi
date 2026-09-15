'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, CheckCircle2, Undo2 } from 'lucide-react'
import {
  DailyPayCalendar,
  type HistoryMonth,
} from './daily-pay-calendar'

function firstOfMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function todayPeriodStart(): string {
  return firstOfMonth(new Date())
}

interface DayDTO {
  date: string
  rateSnapshot: string
}

interface MonthData {
  workerId: string
  periodStart: string
  dailyRate: string | null
  status: 'PENDING' | 'PAID'
  paidAt: string | null
  days: DayDTO[]
  totals: { accrued: string }
}

interface DailyPayPanelProps {
  workerId: string
}

export function DailyPayPanel({ workerId }: DailyPayPanelProps) {
  const [month, setMonth] = useState<MonthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [year, setYear] = useState(() => new Date().getUTCFullYear())
  const [history, setHistory] = useState<HistoryMonth[]>([])

  const periodStart = todayPeriodStart()

  const fetchMonth = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workers/${workerId}/daily-pay?periodStart=${periodStart}`
      )
      if (!res.ok) throw new Error('Failed to fetch')
      setMonth(await res.json())
    } catch {
      setError('Error al cargar datos del mes')
    } finally {
      setLoading(false)
    }
  }, [workerId, periodStart])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workers/${workerId}/daily-pay/history?year=${year}`
      )
      if (!res.ok) throw new Error('Failed to fetch history')
      const data = await res.json()
      setHistory(data.months ?? [])
    } catch {
      // History failure is non-blocking
    }
  }, [workerId, year])

  useEffect(() => {
    fetchMonth()
  }, [fetchMonth])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const today = (() => {
    const d = new Date()
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })()

  const isTodayMarked = month?.days.some((d) => d.date === today) ?? false

  async function toggleToday() {
    const method = isTodayMarked ? 'DELETE' : 'PUT'
    try {
      const res = await fetch(
        `/api/workers/${workerId}/daily-pay/days/${today}`,
        { method }
      )
      if (!res.ok) return
      await fetchMonth()
      await fetchHistory()
    } catch {
      // Toggle failure is non-blocking for the UI
    }
  }

  async function markPaid() {
    try {
      const res = await fetch(
        `/api/workers/${workerId}/daily-pay/months/${periodStart}/mark-paid`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      )
      if (!res.ok) return
      await fetchMonth()
      await fetchHistory()
    } catch {
      // Mark-paid failure is non-blocking for the UI
    }
  }

  async function revertMonth() {
    try {
      const res = await fetch(
        `/api/workers/${workerId}/daily-pay/months/${periodStart}/revert`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      )
      if (!res.ok) return
      await fetchMonth()
      await fetchHistory()
    } catch {
      // Revert failure is non-blocking for the UI
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Cargando...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    )
  }

  const noRate = month?.dailyRate === null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5" />
              Pago Diario
            </CardTitle>
            <Badge variant={month?.status === 'PAID' ? 'default' : 'secondary'}>
              {month?.status === 'PAID' ? 'Pagado' : 'Pendiente'}
            </Badge>
          </div>
          {month?.paidAt && (
            <p className="text-sm text-muted-foreground">
              Pagado el {new Date(month.paidAt).toLocaleDateString('es-AR')}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {noRate && (
            <p className="text-sm text-amber-600">
              Configura la tarifa diaria del trabajador antes de marcar días.
            </p>
          )}

          <p className="text-sm text-muted-foreground">
            Marca los días trabajados. La suma de las tarifas es informativa.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={isTodayMarked ? 'destructive' : 'default'}
              size="sm"
              onClick={toggleToday}
              disabled={month?.status === 'PAID'}
              aria-label={isTodayMarked ? 'Quitar día' : 'Marcar día'}
            >
              {isTodayMarked ? 'Quitar día' : 'Marcar día'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={markPaid}
              disabled={!month || month.days.length === 0}
              aria-label="Marcar como pagado"
            >
              <CheckCircle2 className="mr-1 size-4" />
              Marcar como pagado
            </Button>
            {month?.status === 'PAID' && (
              <Button
                variant="outline"
                size="sm"
                onClick={revertMonth}
                aria-label="Revertir"
              >
                <Undo2 className="mr-1 size-4" />
                Revertir
              </Button>
            )}
          </div>

          {month && month.days.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Días trabajados este mes:</p>
              <ul className="space-y-1" role="list" aria-label="Días trabajados">
                {month.days.map((d) => (
                  <li key={d.date} className="flex items-center justify-between text-sm">
                    <span>{d.date}</span>
                    <span className="font-mono">{d.rateSnapshot}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t pt-2 text-sm font-semibold">
                Total accrual: <span className="font-mono">{month.totals.accrued}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin días registrados este mes
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Historial Anual</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyPayCalendar
            months={history}
            selectedPeriodStart={periodStart}
            year={year}
            onSelectMonth={() => {}}
            onPrevYear={() => setYear((y) => y - 1)}
            onNextYear={() => setYear((y) => y + 1)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
