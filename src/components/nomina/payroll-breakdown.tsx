import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PayrollWithWorker } from '@/types'

interface PayrollBreakdownProps {
  payroll: PayrollWithWorker
}

export function PayrollBreakdown({ payroll }: PayrollBreakdownProps) {
  const totalDeductions = payroll.irpfAmount + payroll.socialSecurityAmount + payroll.otherDeductions
  const bonuses = (payroll as any).bonuses ?? 0
  const bonusesDesc = (payroll as any).bonusesDesc ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desglose Salarial</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Devengos */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Devengos
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between py-1">
                <span>Salario Base</span>
                <span className="font-medium">
                  ${payroll.baseSalary.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {bonuses > 0 && (
                <div className="flex justify-between py-1 text-green-600">
                  <span>
                    Bonificaciones {bonusesDesc ? `(${bonusesDesc})` : ''}
                  </span>
                  <span>
                    +${bonuses.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-t pt-1 font-semibold">
                <span>Total Bruto</span>
                <span>
                  ${payroll.grossPay.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Deducciones */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Deducciones
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between py-1">
                <span>
                  IRPF ({payroll.irpfPercent.toFixed(1)}%)
                </span>
                <span className="text-destructive">
                  -${payroll.irpfAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>
                  Seguridad Social ({payroll.socialSecurityPercent.toFixed(2)}%)
                </span>
                <span className="text-destructive">
                  -${payroll.socialSecurityAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {payroll.otherDeductions > 0 && (
                <div className="flex justify-between py-1">
                  <span>
                    Otros {payroll.otherDeductionsDesc ? `(${payroll.otherDeductionsDesc})` : ''}
                  </span>
                  <span className="text-destructive">
                    -${payroll.otherDeductions.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-t pt-1 font-semibold">
                <span>Total Deducciones</span>
                <span className="text-destructive">
                  -${totalDeductions.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Líquido */}
          <div className="border-t-2 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">Líquido a Percibir</span>
              <span className="text-2xl font-bold">
                ${payroll.netPay.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Notas */}
          {payroll.notes && (
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Notas
              </h3>
              <p className="text-sm text-muted-foreground">{payroll.notes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
