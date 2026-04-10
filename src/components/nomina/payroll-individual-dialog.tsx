'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { UserPlus } from 'lucide-react'

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface Worker {
  id: string
  name: string
  dni: string
  position: string
  baseSalary: number
}

interface PayrollIndividualDialogProps {
  // Opcional: preseleccionar un trabajador (desde ficha de trabajador)
  preselectedWorker?: Worker
}

export function PayrollIndividualDialog({ preselectedWorker }: PayrollIndividualDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)

  // Form state
  const [workerId, setWorkerId] = useState(preselectedWorker?.id ?? '')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [baseSalary, setBaseSalary] = useState(preselectedWorker?.baseSalary.toString() ?? '')
  const [irpfPercent, setIrpfPercent] = useState('15')
  const [bonusAmount, setBonusAmount] = useState('0')
  const [bonusDesc, setBonusDesc] = useState('')
  const [otherDeductions, setOtherDeductions] = useState('0')
  const [otherDeductionsDesc, setOtherDeductionsDesc] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Calculated preview
  const SS_PERCENT = 6.35
  const base = parseFloat(baseSalary) || 0
  const bonus = parseFloat(bonusAmount) || 0
  const grossPay = base + bonus
  const irpfAmount = Math.round(base * (parseFloat(irpfPercent) / 100) * 100) / 100
  const ssAmount = Math.round(base * (SS_PERCENT / 100) * 100) / 100
  const otherDed = parseFloat(otherDeductions) || 0
  const netPay = Math.round((grossPay - irpfAmount - ssAmount - otherDed) * 100) / 100

  useEffect(() => {
    if (open && !preselectedWorker) {
      setLoadingWorkers(true)
      fetch('/api/workers')
        .then((r) => r.json())
        .then((data) => {
          const active = data.filter((w: Worker & { status: string }) => w.status === 'ACTIVE')
          setWorkers(active)
        })
        .catch(() => setError('Error al cargar trabajadores'))
        .finally(() => setLoadingWorkers(false))
    }
  }, [open, preselectedWorker])

  // When worker changes, update base salary
  function handleWorkerChange(id: string) {
    setWorkerId(id)
    const w = workers.find((w) => w.id === id)
    if (w) setBaseSalary(w.baseSalary.toString())
  }

  function resetForm() {
    setWorkerId(preselectedWorker?.id ?? '')
    setBaseSalary(preselectedWorker?.baseSalary.toString() ?? '')
    setMonth(new Date().getMonth() + 1)
    setYear(new Date().getFullYear())
    setIrpfPercent('15')
    setBonusAmount('0')
    setBonusDesc('')
    setOtherDeductions('0')
    setOtherDeductionsDesc('')
    setNotes('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!workerId) {
      setError('Selecciona un trabajador')
      return
    }
    if (base <= 0) {
      setError('El salario base debe ser positivo')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/payroll/individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          month,
          year,
          baseSalary: base,
          irpfPercent: parseFloat(irpfPercent),
          bonusAmount: bonus,
          bonusDesc,
          otherDeductions: otherDed,
          otherDeductionsDesc,
          notes,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al generar la nómina')
        return
      }

      setOpen(false)
      resetForm()
      router.push(`/nomina/${data.id}`)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const selectedWorkerName = preselectedWorker?.name
    ?? workers.find((w) => w.id === workerId)?.name
    ?? ''

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger>
        <Button variant="outline" size="lg" type='button'>
          <UserPlus className="mr-2 size-5" />
          {preselectedWorker ? 'Generar Nómina' : 'Nómina Individual'}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {preselectedWorker
              ? `Nómina — ${preselectedWorker.name}`
              : 'Nómina Individual'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          {/* Trabajador */}
          {preselectedWorker ? (
            <div className="rounded-lg bg-muted px-4 py-3 text-sm">
              <p className="font-medium">{preselectedWorker.name}</p>
              <p className="text-muted-foreground">{preselectedWorker.dni} · {preselectedWorker.position}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="workerId">Trabajador</Label>
              <select
                id="workerId"
                value={workerId}
                onChange={(e) => handleWorkerChange(e.target.value)}
                className={selectClass}
                required
                disabled={loadingWorkers}
              >
                <option value="">
                  {loadingWorkers ? 'Cargando...' : 'Seleccionar trabajador...'}
                </option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.dni}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="month">Mes</Label>
              <select
                id="month"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className={selectClass}
              >
                {MONTH_NAMES.map((name, i) =>
                  i > 0 ? <option key={i} value={i}>{name}</option> : null
                )}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="year">Año</Label>
              <select
                id="year"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className={selectClass}
              >
                {Array.from({ length: 7 }, (_, i) => 2024 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Salario base */}
          <div className="space-y-1">
            <Label htmlFor="baseSalary">Salario Base (€)</Label>
            <Input
              id="baseSalary"
              type="number"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              placeholder="2500"
              min="0"
              step="0.01"
              required
            />
            <p className="text-xs text-muted-foreground">
              Puedes modificarlo si este mes es diferente al registrado
            </p>
          </div>

          {/* IRPF */}
          <div className="space-y-1">
            <Label htmlFor="irpf">% IRPF</Label>
            <Input
              id="irpf"
              type="number"
              value={irpfPercent}
              onChange={(e) => setIrpfPercent(e.target.value)}
              className="w-28"
              min="0"
              max="100"
              step="0.5"
            />
          </div>

          {/* Bono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bonus">Bono / Extra (€)</Label>
              <Input
                id="bonus"
                type="number"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bonusDesc">Descripción bono</Label>
              <Input
                id="bonusDesc"
                value={bonusDesc}
                onChange={(e) => setBonusDesc(e.target.value)}
                placeholder="Productividad, viáticos..."
              />
            </div>
          </div>

          {/* Otras deducciones */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="otherDed">Otras Deducciones (€)</Label>
              <Input
                id="otherDed"
                type="number"
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="otherDedDesc">Descripción</Label>
              <Input
                id="otherDedDesc"
                value={otherDeductionsDesc}
                onChange={(e) => setOtherDeductionsDesc(e.target.value)}
                placeholder="Anticipo, etc."
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones sobre esta nómina..."
            />
          </div>

          {/* Preview en tiempo real */}
          {base > 0 && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
              <p className="font-semibold text-base">
                {selectedWorkerName && <span className="text-muted-foreground font-normal">{selectedWorkerName} · </span>}
                Vista previa
              </p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salario base</span>
                  <span>€{base.toFixed(2)}</span>
                </div>
                {bonus > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Bono</span>
                    <span>+€{bonus.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Bruto</span>
                  <span>€{grossPay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>IRPF ({irpfPercent}%)</span>
                  <span>-€{irpfAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Seg. Social (6.35%)</span>
                  <span>-€{ssAmount.toFixed(2)}</span>
                </div>
                {otherDed > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Otras deducciones</span>
                    <span>-€{otherDed.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>Neto a percibir</span>
                  <span className={netPay < 0 ? 'text-destructive' : ''}>
                    €{netPay.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); resetForm() }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Generando...' : 'Generar Nómina'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}