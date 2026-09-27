'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

type Option = { id: string; name: string }
type Segment = { truckId: string; share: number; kilometers: string; incident: string }
type Operation = {
  companyName: string
  segments: { truckId: string; share: number; kilometers: string | null; incident: string | null }[]
}
type LoadState = 'idle' | 'loading' | 'ready' | 'legacy' | 'other-primary' | 'saving'

const initial = (truckId: string): Segment[] => [{ truckId, share: 100, kilometers: '', incident: '' }]

export function WorkerDayOperationEntry({ truckId, workers, trucks }: {
  truckId: string
  workers: Option[]
  trucks: Option[]
}) {
  const [worker, setWorker] = useState('')
  const [date, setDate] = useState('')
  const [company, setCompany] = useState('')
  const [segments, setSegments] = useState<Segment[]>(() => initial(truckId))
  const [state, setState] = useState<LoadState>('idle')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [primary, setPrimary] = useState('')
  const submitting = useRef(false)
  const endpoint = worker && date
    ? `/api/workers/${encodeURIComponent(worker)}/operations/days/${encodeURIComponent(date)}`
    : ''
  const primaryName = trucks.find(truck => truck.id === primary)?.name ?? primary

  useEffect(() => {
    if (!endpoint) return
    const controller = new AbortController()
    let active = true

    async function load() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
        if (!active) return
        if (response.status === 404) {
          setCompany('')
          setSegments(initial(truckId))
          setLoaded(false)
          setPrimary('')
          setState('ready')
          setMessage('Nueva jornada: completá los datos reales antes de guardar.')
          return
        }
        if (!response.ok) throw new Error('Failed to load workday')
        const data: { operation: Operation | null } = await response.json()
        if (!active) return
        if (!data.operation) {
          setCompany('')
          setSegments(initial(truckId))
          setLoaded(false)
          setPrimary('')
          setState('legacy')
          setMessage('Registro anterior sin empresa ni camión. Solo agregá datos si conocés los detalles reales; la jornada pagada no cambia.')
          return
        }
        const operationPrimary = data.operation.segments[0]?.truckId ?? ''
        setPrimary(operationPrimary)
        setCompany(data.operation.companyName)
        setSegments(data.operation.segments.map(segment => ({
          ...segment,
          kilometers: segment.kilometers ?? '',
          incident: segment.incident ?? '',
        })))
        setLoaded(true)
        setState(operationPrimary === truckId ? 'ready' : 'other-primary')
        setMessage(operationPrimary === truckId
          ? 'Jornada existente cargada para editar.'
          : 'Esta jornada tiene otro camión principal. No se puede editar desde este camión.')
      } catch {
        if (active) {
          setState('idle')
          setMessage('No se pudo consultar la jornada. Volvé a consultar antes de guardar.')
        }
      }
    }

    void load()
    return () => { active = false; controller.abort() }
  }, [endpoint, truckId, revision])

  const changeSelection = (kind: 'worker' | 'date', value: string) => {
    if (kind === 'worker') setWorker(value)
    else setDate(value)
    setCompany('')
    setSegments(initial(truckId))
    setLoaded(false)
    setPrimary('')
    setState('loading')
    setMessage('Consultando jornada…')
  }

  const changeSegment = (index: number, patch: Partial<Segment>) => {
    setSegments(current => current.map((segment, position) =>
      position === index ? { ...segment, ...patch } : segment))
  }

  const valid = !!worker && !!date && !!company.trim() && company.length <= 160 &&
    segments.length >= 1 && segments.length <= 2 &&
    segments.every(segment => !!segment.truckId && Number.isInteger(segment.share) &&
      segment.share >= 1 && segment.share <= 100 && segment.incident.length <= 1000 &&
      (segment.kilometers === '' || (Number.isFinite(Number(segment.kilometers)) &&
        Number(segment.kilometers) >= 0 && Number(segment.kilometers) <= 1000000))) &&
    segments.reduce((sum, segment) => sum + segment.share, 0) === 100 &&
    (segments.length === 1 || (!!segments[0].incident.trim() &&
      segments[0].truckId !== segments[1].truckId)) &&
    segments[0].truckId === truckId

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid || !['ready', 'legacy'].includes(state) || submitting.current) return
    if (state === 'legacy' && !window.confirm(
      'Esta jornada anterior no tiene empresa ni camión registrados. ¿Confirmás que conocés los datos reales y querés adjuntarlos sin cambiar el pago histórico?',
    )) return
    if (loaded && !window.confirm('¿Querés reemplazar los datos operativos existentes de esta jornada?')) return

    submitting.current = true
    setState('saving')
    setMessage('Guardando jornada…')
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: company.trim(),
          segments: segments.map(segment => ({
            truckId: segment.truckId,
            share: segment.share,
            ...(segment.kilometers !== '' ? { kilometers: Number(segment.kilometers) } : {}),
            ...(segment.incident.trim() ? { incident: segment.incident.trim() } : {}),
          })),
        }),
      })
      if (!response.ok) {
        setState('idle')
        setMessage(response.status === 409
          ? 'Conflicto: mes pagado o camión/trabajador ocupado. Consultá la jornada antes de reintentar.'
          : response.status === 400
            ? 'Datos inválidos. Revisá empresa, kilómetros e incidencias; consultá antes de reintentar.'
            : 'No se pudo guardar la jornada. Consultá de nuevo antes de reintentar.')
        return
      }
      setLoaded(true)
      setState('ready')
      setMessage('Jornada guardada correctamente.')
    } catch {
      setState('idle')
      setMessage('No se pudo confirmar el guardado. Consultá la jornada antes de reintentar.')
    } finally {
      submitting.current = false
    }
  }

  const editable = state === 'ready' || state === 'legacy'
  const fieldClass = 'block w-full rounded border p-2'
  const buttonClass = 'w-full rounded border px-3 py-2 sm:w-auto'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Trabajador
          <select className={fieldClass} value={worker} disabled={state === 'saving'}
            onChange={event => changeSelection('worker', event.target.value)} required>
            <option value="">Seleccioná un trabajador</option>
            {workers.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <label>
          Fecha
          <input className={fieldClass} type="date" value={date} disabled={state === 'saving'}
            onChange={event => changeSelection('date', event.target.value)} required />
        </label>
      </div>
      {state === 'other-primary' ? (
        <p>Camión principal: {primaryName}. Para editar esta jornada, abrí la vista de ese camión.</p>
      ) : (
        <fieldset disabled={!editable} className="space-y-4 disabled:opacity-60">
          <label className="block">
            Empresa
            <input className={fieldClass} value={company} maxLength={160}
              onChange={event => setCompany(event.target.value)} required />
          </label>
          <p className="text-sm">Camión principal de esta entrada: {trucks.find(truck => truck.id === truckId)?.name ?? truckId}</p>
          <label className="block">
            Kilómetros del camión principal
            <input className={fieldClass} type="number" min="0" max="1000000" step="any"
              value={segments[0].kilometers}
              onChange={event => changeSegment(0, { kilometers: event.target.value })} />
          </label>
          {segments.length === 2 ? (
            <div className="space-y-4">
              <label className="block">
                Incidencia del camión averiado
                <textarea className={fieldClass} maxLength={1000} required value={segments[0].incident}
                  onChange={event => changeSegment(0, { incident: event.target.value })} />
              </label>
              <label className="block">
                Camión de sustitución
                <select className={fieldClass} value={segments[1].truckId}
                  onChange={event => changeSegment(1, { truckId: event.target.value })} required>
                  <option value="">Seleccioná un camión</option>
                  {trucks.filter(truck => truck.id !== truckId).map(option => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                Kilómetros del sustituto
                <input className={fieldClass} type="number" min="0" max="1000000" step="any"
                  value={segments[1].kilometers}
                  onChange={event => changeSegment(1, { kilometers: event.target.value })} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  Porcentaje principal
                  <input className={fieldClass} type="number" min="1" max="100" step="1"
                    value={segments[0].share}
                    onChange={event => changeSegment(0, { share: Number(event.target.value) })} />
                </label>
                <label>
                  Porcentaje sustituto
                  <input className={fieldClass} type="number" min="1" max="100" step="1"
                    value={segments[1].share}
                    onChange={event => changeSegment(1, { share: Number(event.target.value) })} />
                </label>
              </div>
              <button type="button" className={buttonClass} onClick={() => setSegments(initial(truckId))}>
                Quitar sustitución
              </button>
            </div>
          ) : (
            <button type="button" className={buttonClass} onClick={() => setSegments([
              { ...segments[0], share: 50 },
              { truckId: '', share: 50, kilometers: '', incident: '' },
            ])}>
              Añadir sustitución por avería
            </button>
          )}
          <p className="text-sm">
            Distribución de actividad: {segments.reduce((sum, segment) => sum + segment.share, 0)}%
            {' '}(debe sumar 100%). El sustituto debe haber estado libre todo el día.
          </p>
        </fieldset>
      )}
      <p role="status" aria-live="polite">{message}</p>
      {state === 'idle' && endpoint && (
        <button type="button" className={buttonClass} onClick={() => {
          setState('loading')
          setRevision(value => value + 1)
        }}>
          Volver a consultar
        </button>
      )}
      <button type="submit" disabled={!editable || !valid}
        className="w-full rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50 sm:w-auto">
        {state === 'saving' ? 'Guardando…' : 'Guardar jornada'}
      </button>
    </form>
  )
}
