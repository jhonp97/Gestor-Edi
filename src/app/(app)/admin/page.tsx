'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ComplianceWidget } from '@/components/admin/compliance-widget'
import { Users, Building2, Truck, ClipboardList, Activity } from 'lucide-react'

interface PlatformStats {
  users: number
  orgs: number
  workers: number
  trucks: number
  transactions: number
  consentStats: { total: number }
  pendingDeletions: number
  recentAuditLogs: Array<{
    id: string
    action: string
    createdAt: string
    userId?: string | null
    details?: Record<string, unknown> | null
  }>
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) {
        setError('Error al cargar estadísticas')
        return
      }
      const data = await res.json()
      setStats(data)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        {error || 'Error al cargar datos'}
      </div>
    )
  }

  const metricCards = [
    {
      label: 'Total Usuarios',
      value: stats.users,
      icon: Users,
      color: 'bg-blue-500/10 text-blue-600',
    },
    {
      label: 'Organizaciones',
      value: stats.orgs,
      icon: Building2,
      color: 'bg-purple-500/10 text-purple-600',
    },
    {
      label: 'Trabajadores',
      value: stats.workers,
      icon: Activity,
      color: 'bg-green-500/10 text-green-600',
    },
    {
      label: 'Camiones',
      value: stats.trucks,
      icon: Truck,
      color: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: 'Transacciones',
      value: stats.transactions,
      icon: ClipboardList,
      color: 'bg-red-500/10 text-red-600',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de Administración</h1>
        <p className="text-muted-foreground">
          Métricas y gestión de la plataforma
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {metricCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex size-10 items-center justify-center rounded-lg ${card.color}`}>
                <card.icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value.toLocaleString('es-ES')}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance Widget */}
      <ComplianceWidget
        consentStats={stats.consentStats}
        pendingDeletions={stats.pendingDeletions}
        recentAuditLogs={stats.recentAuditLogs}
      />

      {/* Recent Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentAuditLogs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No hay actividad reciente
            </p>
          ) : (
            <div className="space-y-2">
              {stats.recentAuditLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                    {log.userId && (
                      <span className="ml-2 text-muted-foreground">
                        — Usuario {log.userId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString('es-ES', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
