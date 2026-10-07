import 'server-only'
import { getEncryptionService } from '@/services/encryption.service'

/** Map stored payroll identity for presentation only; never mutate persisted data. */
export async function mapPayrollWorkerIdentity<T extends { worker: { dni: string | null } }>(payroll: T) {
  const storedDni = payroll.worker.dni
  let dni = storedDni ?? ''

  // Legacy plaintext has no separator; encrypted records use iv:ciphertext.
  if (dni.includes(':')) {
    try {
      dni = await getEncryptionService().decryptWorkerDni(dni)
    } catch {
      // Missing keys or corrupt records must not leak ciphertext or PII in logs.
      dni = ''
    }
  }

  return { ...payroll, worker: { ...payroll.worker, dni } }
}
