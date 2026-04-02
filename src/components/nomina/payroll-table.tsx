import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import type { PayrollWithWorker } from '@/types'

interface PayrollTableProps {
  payrolls: PayrollWithWorker[]
}

const MONTH_NAMES = [
  '', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export function PayrollTable({ payrolls }: PayrollTableProps) {
  if (payrolls.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No hay nóminas para el período seleccionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle de Nóminas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Trabajador</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Período</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Salario Base</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">IRPF</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Seg. Social</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Bruto</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Neto</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Estado</th>
                <th className="pb-3 font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map((p) => (
                <tr
                  key={p.id}
                  className="border-b last:border-b-0"
                >
                  <td className="py-3 pr-4">
                    <div>
                      <p className="font-medium">{p.worker.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.worker.dni}</p>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-sm">
                    {MONTH_NAMES[p.month]} {p.year}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    ${p.baseSalary.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 pr-4 text-right text-sm">
                    {p.irpfPercent.toFixed(1)}%
                    <span className="block text-xs text-muted-foreground">
                      (${p.irpfAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-sm">
                    {p.socialSecurityPercent.toFixed(2)}%
                    <span className="block text-xs text-muted-foreground">
                      (${p.socialSecurityAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-medium">
                    ${p.grossPay.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold">
                    ${p.netPay.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={p.paidAt ? 'default' : 'secondary'}>
                      {p.paidAt ? 'Pagado' : 'Pendiente'}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <Link href={`/nomina/${p.id}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="size-4" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
