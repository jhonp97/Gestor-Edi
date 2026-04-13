export class LastAdminError extends Error {
  constructor(message = 'La organización debe tener al menos un administrador') {
    super(message)
    this.name = 'LastAdminError'
  }
}
