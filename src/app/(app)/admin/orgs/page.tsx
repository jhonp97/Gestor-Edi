'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, Truck, Briefcase } from 'lucide-react'

interface OrgEntry {
  id: string
  name: string
  planType: string
  planStatus: string
  memberCount: number
  truckCount: number
  workerCount: number
  transactionCount: number
  createdAt: string
}

function PlanBadge({ plan }: { plan: string }) {
  const variant = plan === 'ENTERPRISE' ? 'default' : plan === 'PRO' ? 'secondary' : 'outline'
  return <Badge variant={variant as 'default' | 'secondary' | 'outline'}>{plan}</Badge>
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'ACTIVE' ? 'default' : status === 'TRIAL' ? 'secondary' : 'destructive'
  const label =
    status === 'ACTIVE'
      ? 'Activo'
      : status === 'TRIAL'
      ? 'Trial'
      : status === 'PAST_DUE'
      ? 'Vencido'
      : 'Cancelado'
  return <Badge variant={variant as 'default' | 'secondary' | 'destructive'}>{label}</Badge>
}

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<OrgEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/admin/orgs')
        if (!res.ok) {
          if (!cancelled) setError('Error al cargar organizaciones')
          return
        }
        const data = await res.json()
        if (!cancelled) setOrgs(data.data)
      } catch {
        if (!cancelled) setError('Error de conexión')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Organizaciones</h1>
        <p className="text-muted-foreground">
          Todas las organizaciones en la plataforma
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Organizaciones ({orgs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No hay organizaciones registradas
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Miembros</TableHead>
                  <TableHead className="text-center">Camiones</TableHead>
                  <TableHead className="text-center">Trabajadores</TableHead>
                  <TableHead className="text-center">Transacciones</TableHead>
                  <TableHead>Creada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <PlanBadge plan={org.planType} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={org.planStatus} />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3 text-muted-foreground" />
                        {org.memberCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <Truck className="size-3 text-muted-foreground" />
                        {org.truckCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="size-3 text-muted-foreground" />
                        {org.workerCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {org.transactionCount.toLocaleString('es-ES')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(org.createdAt).toLocaleDateString('es-ES')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
