import { Card, CardContent } from '@/components/ui/card'
import { Shield, Trash2, Activity } from 'lucide-react'

interface RecentAuditLog {
  id: string
  action: string
  createdAt: string
  userId?: string | null
  details?: Record<string, unknown> | null
}

interface ComplianceWidgetProps {
  consentStats: { total: number }
  pendingDeletions: number
  recentAuditLogs: RecentAuditLog[]
}

export function ComplianceWidget({
  consentStats,
  pendingDeletions,
  recentAuditLogs,
}: ComplianceWidgetProps) {
  const lastAuditTime =
    recentAuditLogs.length > 0
      ? new Date(recentAuditLogs[0].createdAt).toLocaleString('es-ES', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'Nunca'

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Consent Coverage */}
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
            <Shield className="size-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{consentStats.total}</p>
            <p className="text-sm text-muted-foreground">
              Registros de consentimiento
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pending Deletions */}
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className={`flex size-10 items-center justify-center rounded-lg ${
              pendingDeletions > 0 ? 'bg-red-500/10' : 'bg-muted'
            }`}
          >
            <Trash2
              className={`size-5 ${pendingDeletions > 0 ? 'text-red-600' : 'text-muted-foreground'}`}
            />
          </div>
          <div>
            <p className="text-2xl font-bold">{pendingDeletions}</p>
            <p className="text-sm text-muted-foreground">
              Solicitudes de eliminación pendientes
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Last Audit Log */}
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Activity className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium">{lastAuditTime}</p>
            <p className="text-sm text-muted-foreground">
              Último registro de auditoría
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
