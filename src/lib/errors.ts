export class LastAdminError extends Error {
  constructor(message = 'La organización debe tener al menos un administrador') {
    super(message)
    this.name = 'LastAdminError'
  }
}

export class PlanLimitError extends Error {
  public readonly resource: string
  public readonly limit: number
  public readonly plan: string

  constructor(resource: string, limit: number, plan: string, message?: string) {
    const defaultMessage = `Límite de ${resource} alcanzado (${limit}) en plan ${plan}. Actualiza a un plan superior para más capacidad.`
    super(message ?? defaultMessage)
    this.name = 'PlanLimitError'
    this.resource = resource
    this.limit = limit
    this.plan = plan
  }
}
