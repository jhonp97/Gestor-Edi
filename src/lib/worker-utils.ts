import { getEncryptionService } from '@/services/encryption.service'

/**
 * Detecta el tipo de documento basado en su formato
 */
export function detectDocType(dni: string): 'DNI' | 'NIE' | 'PASAPORTE' | 'OTRO' {
  const upper = dni.toUpperCase()
  if (/^\d{8}[A-Z]$/.test(upper)) return 'DNI'
  if (/^[XYZ]\d{7}[A-Z]$/.test(upper)) return 'NIE'
  if (/^[A-Z0-9]{6,9}$/.test(upper)) return 'PASAPORTE'
  return 'OTRO'
}

/**
 * Desencripta el DNI de un trabajador.
 * Si ya está en plaintext o está vacío, lo devuelve tal cual.
 */
export async function decryptWorkerDni(encryptedDni: string | null): Promise<string> {
  if (!encryptedDni || encryptedDni.length === 0) return ''
  // Si no parece encriptado (no tiene formato iv:ciphertext), devolver tal cual
  if (!encryptedDni.includes(':')) return encryptedDni

  try {
    const enc = getEncryptionService()
    return await enc.decryptWorkerDni(encryptedDni)
  } catch {
    // Si falla la desencriptación, devolver el valor enmascarado o raw
    return encryptedDni
  }
}

/**
 * Desencripta los DNIs de una lista de workers.
 * Útil para Server Components que cargan listados.
 */
export async function decryptWorkersDnis<T extends { dni: string | null }>(
  workers: T[]
): Promise<(T & { decryptedDni: string; docType: string })[]> {
  const enc = getEncryptionService()

  return Promise.all(
    workers.map(async (worker) => {
      let decrypted = ''
      if (worker.dni && worker.dni.includes(':')) {
        try {
          decrypted = await enc.decryptWorkerDni(worker.dni)
        } catch {
          decrypted = worker.dni
        }
      } else {
        decrypted = worker.dni || ''
      }
      return {
        ...worker,
        decryptedDni: decrypted,
        docType: detectDocType(decrypted),
      }
    })
  )
}
