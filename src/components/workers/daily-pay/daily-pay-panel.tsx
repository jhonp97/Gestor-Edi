'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarDays, CheckCircle2, Undo2 } from 'lucide-react'
import {
  DailyPayCalendar,
  type HistoryMonth,
} from './daily-pay-calendar'

function formatCivilDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
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
  trucks?: { id: string; name: string }[]
}

type Operation = { companyName: string; segments: { truckId: string; share: number; kilometers: string | null; incident: string | null }[] }
type DayDetail = { date: string; operation: Operation | null }

const DAILY_RATE_HELPER = 'Déjala vacía para quitar la tarifa diaria.'
const DECIMAL_RATE_PATTERN = /^\d+(\.\d+)?$/

export function DailyPayPanel({ workerId, trucks = [] }: DailyPayPanelProps) {
  const [month, setMonth] = useState<MonthData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [today] = useState(() => formatCivilDate(new Date()))
  const [selectedDate, setSelectedDate] = useState(today)
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const [history, setHistory] = useState<HistoryMonth[]>([])
  const [dailyRateInput, setDailyRateInput] = useState('')
  const [isSavingRate, setIsSavingRate] = useState(false)
  const [isUpdatingDay, setIsUpdatingDay] = useState(false)
  const [dayError, setDayError] = useState<string | null>(null)
  const [detail, setDetail] = useState<DayDetail | null>(null)
  const [detailError, setDetailError] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rateFeedback, setRateFeedback] = useState({
    message: DAILY_RATE_HELPER,
    isError: false,
  })

  const periodStart = `${today.slice(0, 7)}-01`

  const fetchMonth = useCallback(async (): Promise<MonthData> => {
    const res = await fetch(
      `/api/workers/${workerId}/daily-pay?periodStart=${periodStart}`
    )
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json()
  }, [workerId, periodStart])

  const fetchHistory = useCallback(async (): Promise<HistoryMonth[]> => {
    const res = await fetch(
      `/api/workers/${workerId}/daily-pay/history?year=${year}`
    )
    if (!res.ok) throw new Error('Failed to fetch history')
    const data = await res.json()
    return data.months ?? []
  }, [workerId, year])

  useEffect(() => {
    let cancelled = false

    void fetchMonth()
      .then((data) => {
        if (!cancelled) {
          setMonth(data)
          setDailyRateInput(data.dailyRate ?? '')
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Error al cargar datos del mes')
      })

    return () => {
      cancelled = true
    }
  }, [fetchMonth])

  useEffect(() => {
    let cancelled = false

    void fetchHistory()
      .then((data) => {
        if (!cancelled) setHistory(data)
      })
      .catch(() => {
        // History failure is non-blocking
      })

    return () => {
      cancelled = true
    }
  }, [fetchHistory])

  const loading = month === null && error === null

  async function refreshData() {
    try {
      const data = await fetchMonth()
      setMonth(data)
      setDailyRateInput(data.dailyRate ?? '')
      setError(null)
    } catch {
      setError('Error al cargar datos del mes')
    }

    try {
      setHistory(await fetchHistory())
    } catch {
      // History failure is non-blocking
    }
  }

  async function saveDailyRate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedRate = dailyRateInput.trim()
    if (
      trimmedRate !== '' &&
      (!DECIMAL_RATE_PATTERN.test(trimmedRate) || Number(trimmedRate) < 0.01)
    ) {
      setRateFeedback({
        message: 'Ingresa una tarifa diaria de al menos 0,01.',
        isError: true,
      })
      return
    }

    setIsSavingRate(true)
    setRateFeedback({ message: DAILY_RATE_HELPER, isError: false })

    try {
      const res = await fetch(
        `/api/workers/${workerId}/daily-pay?periodStart=${periodStart}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dailyRate: trimmedRate || null }),
        }
      )

      if (!res.ok) {
        setRateFeedback({
          message: 'No se pudo guardar la tarifa diaria.',
          isError: true,
        })
        return
      }

      const data: MonthData = await res.json()
      setMonth(data)
      setDailyRateInput(data.dailyRate ?? '')
      setError(null)
      setRateFeedback({
        message: data.dailyRate
          ? 'Tarifa diaria guardada.'
          : 'Tarifa diaria eliminada.',
        isError: false,
      })
    } catch {
      setRateFeedback({
        message: 'Error de conexión al guardar la tarifa diaria.',
        isError: true,
      })
    } finally {
      setIsSavingRate(false)
    }
  }

  const isSelectedDateMarked = month?.days.some((day) => day.date === selectedDate) ?? false

  useEffect(() => {
    if (!month?.days.some(day => day.date === selectedDate)) return
    let cancelled = false
    const controller = new AbortController()
    // Clear the previous selection immediately; failures must never look like legacy data.
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setDetail(null)
      setDetailError(false)
      setDetailLoading(true)
      try {
        const res = await fetch(`/api/workers/${workerId}/operations/days/${selectedDate}`, { signal: controller.signal })
        if (!res.ok) throw new Error('Failed to load operation')
        const data: DayDetail = await res.json()
        if (!cancelled) setDetail(data)
      } catch {
        if (!cancelled) setDetailError(true)
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })
    return () => { cancelled = true; controller.abort() }
  }, [workerId, selectedDate, month])

  async function toggleSelectedDate() {
    if (dayEditingDisabled || isSelectedDateMarked && (detailLoading || detailError || !detail || detail.operation)) return
    const method = isSelectedDateMarked ? 'DELETE' : 'PUT'
    setIsUpdatingDay(true)
    setDayError(null)

    try {
      const res = await fetch(
        `/api/workers/${workerId}/daily-pay/days/${selectedDate}`,
        { method }
      )
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null)
        const message = data && typeof data === 'object' && 'error' in data
          ? String(data.error)
          : 'No se pudo actualizar el día seleccionado.'
        setDayError(message)
        return
      }
      await refreshData()
    } catch {
      setDayError('Error de conexión al actualizar el día seleccionado.')
    } finally {
      setIsUpdatingDay(false)
    }
  }

  async function markPaid() {
    try {
      const res = await fetch(
        `/api/workers/${workerId}/daily-pay/months/${periodStart}/mark-paid`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      )
      if (!res.ok) return
      await refreshData()
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
      await refreshData()
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

  const noRate = !month?.dailyRate || Number(month.dailyRate) <= 0
  const dayEditingDisabled = month?.status === 'PAID' || noRate || isUpdatingDay
  const selectedDetail = isSelectedDateMarked && detail?.date === selectedDate ? detail : null
  const removalGuarded = isSelectedDateMarked && (detailLoading || detailError || !selectedDetail || !!selectedDetail.operation)

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

          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={saveDailyRate}
            noValidate
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="daily-rate">Tarifa diaria</Label>
              <Input
                id="daily-rate"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={dailyRateInput}
                onChange={(event) => {
                  setDailyRateInput(event.target.value)
                  setRateFeedback({ message: DAILY_RATE_HELPER, isError: false })
                }}
                aria-describedby="daily-rate-feedback"
                aria-invalid={rateFeedback.isError}
                disabled={isSavingRate}
              />
              <p
                id="daily-rate-feedback"
                className={rateFeedback.isError
                  ? 'text-xs text-destructive'
                  : 'text-xs text-muted-foreground'}
                aria-live="polite"
              >
                {rateFeedback.message}
              </p>
            </div>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={isSavingRate}
            >
              {isSavingRate ? 'Guardando...' : 'Guardar tarifa'}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">
            Marca los días trabajados. La suma de las tarifas es informativa.
          </p>

          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="worked-day">Fecha trabajada</Label>
                <Input
                  id="worked-day"
                  type="date"
                  min={periodStart}
                  max={today}
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value)
                    setDetail(null)
                    setDetailError(false)
                    setDetailLoading(true)
                    setDayError(null)
                  }}
                  aria-describedby="selected-worked-day daily-pay-day-error"
                />
                <p id="selected-worked-day" className="text-xs text-muted-foreground">
                  Fecha seleccionada: {selectedDate}
                </p>
              </div>
              <Button
                variant={isSelectedDateMarked ? 'destructive' : 'default'}
                size="sm"
                className="w-full sm:w-auto"
                onClick={toggleSelectedDate}
                disabled={dayEditingDisabled || removalGuarded}
                aria-label={isSelectedDateMarked ? 'Quitar día' : 'Marcar día'}
              >
                {isUpdatingDay
                  ? 'Actualizando...'
                  : isSelectedDateMarked
                    ? 'Quitar día'
                    : 'Marcar día'}
              </Button>
            </div>
            {isSelectedDateMarked && (
              <div className="space-y-2 text-sm" aria-live="polite">
                {detailLoading && <p>Cargando detalles del día...</p>}
                {detailError && <p role="alert">No se pudieron cargar los detalles. Reintentá seleccionando la fecha nuevamente; no se puede quitar el día sin verificarlo.</p>}
                {selectedDetail?.operation === null && <p>Los detalles históricos de este día son desconocidos. Solo se puede quitar este registro legado desde aquí.</p>}
                {selectedDetail?.operation && <div className="space-y-1">
                  <p>Empresa: <span>{selectedDetail.operation.companyName}</span></p>
                  <p>Este día tiene una operación: editá el registro desde el detalle del camión; no se puede quitar desde pago diario.</p>
                  {selectedDetail.operation.segments.map((segment, index) => (
                    <div key={segment.truckId}>
                      <p>{index === 0 ? 'Camión principal' : 'Camión de reemplazo'}: <Link className="underline" href={`/trucks/${segment.truckId}`}>{trucks.find(truck => truck.id === segment.truckId)?.name ?? 'Camión registrado'}</Link></p>
                      <p>Actividad: {segment.share}% · Kilómetros: {segment.kilometers ?? 'Sin registrar'}</p>
                      {segment.incident && <p>Incidente: <span>{segment.incident}</span></p>}
                    </div>
                  ))}
                </div>}
              </div>
            )}
            {dayError && (
              <p id="daily-pay-day-error" className="text-sm text-destructive" role="alert">
                {dayError}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
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
                Total acumulado: <span className="font-mono">{month.totals.accrued}</span>
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
