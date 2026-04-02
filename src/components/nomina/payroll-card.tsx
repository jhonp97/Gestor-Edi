import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Eye } from 'lucide-react'

interface PayrollCardProps {
  id: string
  workerName: string
  workerDni: string
  position: string
  month: number
  year: number
  baseSalary: number
  irpfAmount: number
  ssAmount: number
  otherDeductions: number
  grossPay: number
  netPay: number
  paidAt: Date | null
}

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function PayrollCard({
  id,
  workerName,
  workerDni,
  position,
  month,
  year,
  baseSalary,
  irpfAmount,
  ssAmount,
  otherDeductions,
  netPay,
  paidAt,
}: PayrollCardProps) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{workerName}</h3>
              <Badge variant={paidAt ? 'default' : 'secondary'}>
                {paidAt ? 'Pagado' : 'Pendiente'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {workerDni} &middot; {position}
            </p>
            <p className="text-sm text-muted-foreground">
              {MONTH_NAMES[month]} {year}
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">Salario Base:</span>
              <span className="text-right font-medium">
                ${baseSalary.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-muted-foreground">IRPF:</span>
              <span className="text-right text-destructive">
                -${irpfAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-muted-foreground">Seg. Social:</span>
              <span className="text-right text-destructive">
                -${ssAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
              {otherDeductions > 0 && (
                <>
                  <span className="text-muted-foreground">Otros:</span>
                  <span className="text-right text-destructive">
                    -${otherDeductions.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </>
              )}
              <div className="border-t pt-1 mt-1 font-semibold">
                <span className="text-muted-foreground">Neto:</span>
              </div>
              <div className="border-t pt-1 mt-1 text-right font-bold text-lg">
                ${netPay.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <Link href={`/nomina/${id}`}>
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              <Eye className="size-4 mr-1" />
              Ver
            </Badge>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
