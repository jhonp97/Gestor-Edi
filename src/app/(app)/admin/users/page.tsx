'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Trash2, Shield, User, Users, Calendar } from 'lucide-react'

interface UserData {
  id: string
  name: string
  email: string
  role: 'USER' | 'ADMIN'
  createdAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const [usersRes, sessionRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/auth/session'),
      ])

      const usersData = await usersRes.json()
      const sessionData = await sessionRes.json()

      if (!usersRes.ok) {
        setError(usersData.error || 'Error al cargar usuarios')
        return
      }

      setUsers(usersData.users)
      setCurrentUserId(sessionData?.user?.id || null)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`¿Estás seguro de eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) {
      return
    }

    setDeleting(id)

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Error al eliminar usuario')
        return
      }

      setUsers(users.filter((u) => u.id !== id))
    } catch {
      alert('Error de conexión')
    } finally {
      setDeleting(null)
    }
  }

  async function changeRole(id: string, newRole: 'USER' | 'ADMIN') {
    setChangingRole(id)

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Error al cambiar rol')
        return
      }

      setUsers(users.map((u) => (u.id === id ? { ...u, role: newRole } : u)))
    } catch {
      alert('Error de conexión')
    } finally {
      setChangingRole(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Cargando usuarios...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Gestión de Usuarios
        </h1>
        <p className="text-lg text-muted-foreground">
          Administra los usuarios del sistema
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">Total Usuarios</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
              <User className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {users.filter((u) => u.role === 'USER').length}
              </p>
              <p className="text-sm text-muted-foreground">Usuarios</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Shield className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {users.filter((u) => u.role === 'ADMIN').length}
              </p>
              <p className="text-sm text-muted-foreground">Administradores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No hay usuarios registrados
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Nombre</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Rol</th>
                    <th className="pb-3 font-medium">Registro</th>
                    <th className="pb-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId
                    return (
                      <tr key={user.id} className="text-sm">
                        <td className="py-3 font-medium">{user.name}</td>
                        <td className="py-3 text-muted-foreground">
                          {user.email}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                              user.role === 'ADMIN'
                                ? 'bg-amber-500/10 text-amber-700'
                                : 'bg-green-500/10 text-green-700'
                            }`}
                          >
                            {user.role === 'ADMIN' ? (
                              <Shield className="size-3" />
                            ) : (
                              <User className="size-3" />
                            )}
                            {user.role === 'ADMIN' ? 'Admin' : 'Usuario'}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(user.createdAt).toLocaleDateString('es-ES')}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isSelf ? (
                              <span className="text-xs text-muted-foreground italic px-2">
                                Tú
                              </span>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() =>
                                    changeRole(
                                      user.id,
                                      user.role === 'ADMIN' ? 'USER' : 'ADMIN'
                                    )
                                  }
                                  disabled={changingRole === user.id}
                                >
                                  {user.role === 'ADMIN' ? (
                                    <>
                                      <User className="mr-1 size-3" />
                                      Hacer Usuario
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="mr-1 size-3" />
                                      Hacer Admin
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="xs"
                                  onClick={() => deleteUser(user.id, user.name)}
                                  disabled={deleting === user.id}
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}