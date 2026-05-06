'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import type { MileageRecord } from '@/types'

const selectClass =
  'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type TruckMileageHistoryProps = {
  truckId: string
  records: MileageRecord[]
}

export function TruckMileageHistory({ truckId, records }: TruckMileageHistoryProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  // Extract available years from records
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    records.forEach((r) => years.add(new Date(r.date).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [records])

  const [selectedYear, setSelectedYear] = useState<number>(
    availableYears[0] ?? new Date().getFullYear()
  )
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  // Filter records client-side
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const d = new Date(r.date)
      if (d.getFullYear() !== selectedYear) return false
      if (selectedMonth && d.getMonth() + 1 !== parseInt(selectedMonth)) return false
      return true
    })
  }, [records, selectedYear, selectedMonth])

  const totalFilteredKm = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.km, 0)
  }, [filteredRecords])

  async function handleDelete(mileageId: string) {
    if (!confirm('¿Eliminar este registro de kilometraje? Esta acción no se puede deshacer.')) {
      return
    }

    setDeleting(mileageId)
    try {
      const res = await fetch(`/api/trucks/${truckId}/mileage/${mileageId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Error al eliminar registro')
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Historial de Kilometraje</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(parseInt(e.target.value))
                setSelectedMonth('')
              }}
              className={selectClass}
              aria-label="Seleccionar año"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={selectClass}
              aria-label="Seleccionar mes"
            >
              <option value="">Todos los meses</option>
              {[
                { value: '1', label: 'Enero' },
                { value: '2', label: 'Febrero' },
                { value: '3', label: 'Marzo' },
                { value: '4', label: 'Abril' },
                { value: '5', label: 'Mayo' },
                { value: '6', label: 'Junio' },
                { value: '7', label: 'Julio' },
                { value: '8', label: 'Agosto' },
                { value: '9', label: 'Septiembre' },
                { value: '10', label: 'Octubre' },
                { value: '11', label: 'Noviembre' },
                { value: '12', label: 'Diciembre' },
              ].map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredRecords.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">
            No hay registros de kilometraje para este período.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Kilómetros</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {new Date(record.date).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {record.km.toLocaleString('es-ES')} km
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.notes || '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(record.id)}
                        disabled={deleting === record.id}
                        aria-label="Eliminar registro"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-sm text-muted-foreground text-right">
              Total: <strong>{totalFilteredKm.toLocaleString('es-ES')} km</strong>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
