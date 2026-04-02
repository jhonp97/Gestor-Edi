'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const SS_PERCENT = 6.35

interface PreviewWorker {
  id: string
  name: string
  dni: string
  position: string
  baseSalary: number
  irpfAmount: number
  ssAmount: number
  netPay: number
}

export default function GeneratePayrollPage() {
  const router = useRouter()
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [irpfPercent, setIrpfPercent] = useState('15')
  const [preview, setPreview] = useState<PreviewWorker[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [generated, setGenerated] = useState(false)

  const handlePreview = () => {
    setError('')
    setSuccess('')

    const irpf = parseFloat(irpfPercent)
    if (isNaN(irpf) || irpf < 0 || irpf > 100) {
      setError('El % IRPF debe estar entre 0 y 100')
      return
    }

    // Fetch active workers and calculate preview
    fetch('/api/workers')
      .then((res) => res.json())
      .then((workers) => {
        const activeWorkers = workers.filter((w: { status: string }) => w.status === 'ACTIVE')
        const calculated = activeWorkers.map((w: { id: string; name: string; dni: string; position: string; baseSalary: number }) => {
          const irpfAmount = Math.round(w.baseSalary * (irpf / 100) * 100) / 100
          const ssAmount = Math.round(w.baseSalary * (SS_PERCENT / 100) * 100) / 100
          const netPay = Math.round((w.baseSalary - irpfAmount - ssAmount) * 100) / 100
          return {
            id: w.id,
            name: w.name,
            dni: w.dni,
            position: w.position,
            baseSalary: w.baseSalary,
            irpfAmount,
            ssAmount,
            netPay,
          }
        })
        setPreview(calculated)
      })
      .catch(() => setError('Error al cargar trabajadores'))
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          year,
          irpfPercent: parseFloat(irpfPercent),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al generar la nómina')
        return
      }

      setSuccess(
        `Nómina generada: ${data.created} creadas, ${data.skipped} omitidas`
      )
      setGenerated(true)

      setTimeout(() => {
        router.push(`/nomina?month=${month}&year=${year}`)
      }, 2000)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/nomina">
          <Button variant="outline" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Generar Nómina</h1>
          <p className="text-lg text-muted-foreground">
            Crear nóminas para todos los trabajadores activos
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parámetros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="month">Mes</Label>
              <select
                id="month"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MONTH_NAMES.map((name, i) =>
                  i > 0 ? (
                    <option key={i} value={i}>
                      {name}
                    </option>
                  ) : null,
                )}
              </select>
            </div>
            <div>
              <Label htmlFor="year">Año</Label>
              <select
                id="year"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Array.from({ length: 7 }, (_, i) => 2024 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="irpf">% IRPF</Label>
              <Input
                id="irpf"
                type="number"
                value={irpfPercent}
                onChange={(e) => setIrpfPercent(e.target.value)}
                className="w-24"
                min="0"
                max="100"
                step="0.5"
              />
            </div>
            <Button onClick={handlePreview} variant="outline">
              Vista Previa
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Vista Previa — {MONTH_NAMES[month]} {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Trabajador</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">DNI</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Puesto</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Salario Base</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">IRPF</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Seg. Social</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((w) => (
                    <tr key={w.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-4 font-medium">{w.name}</td>
                      <td className="py-3 pr-4 font-mono text-sm">{w.dni}</td>
                      <td className="py-3 pr-4">{w.position}</td>
                      <td className="py-3 pr-4 text-right">
                        ${w.baseSalary.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 pr-4 text-right text-destructive">
                        -${w.irpfAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 pr-4 text-right text-destructive">
                        -${w.ssAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right font-semibold">
                        ${w.netPay.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td colSpan={3} className="py-3 pr-4">
                      Total ({preview.length} trabajadores)
                    </td>
                    <td className="py-3 pr-4 text-right">
                      ${preview.reduce((s, w) => s + w.baseSalary, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 pr-4 text-right text-destructive">
                      -${preview.reduce((s, w) => s + w.irpfAmount, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 pr-4 text-right text-destructive">
                      -${preview.reduce((s, w) => s + w.ssAmount, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-right">
                      ${preview.reduce((s, w) => s + w.netPay, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {!generated && (
              <div className="mt-4 flex justify-end">
                <Button onClick={handleGenerate} disabled={loading} size="lg">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    'Generar Nómina'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-900/20 dark:text-green-400">
          <Badge variant="default">✓</Badge>
          <span>{success}</span>
        </div>
      )}
    </div>
  )
}
