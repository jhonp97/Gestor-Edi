/**
 * DNI Encryption Migration Script
 * 
 * MIGRATE: Encrypt all plaintext DNI values in the Worker table.
 * 
 * This script:
 * 1. Fetches all Workers that have a plaintext DNI (no ':' separator, i.e., not yet encrypted)
 * 2. Encrypts the DNI using AES-256-CBC
 * 3. Computes the SHA-256 hash for dniHash lookups
 * 4. Updates each Worker record with encrypted dni and dniHash
 * 
 * Usage:
 *   pnpm tsx prisma/migrate-dni-encryption.ts
 * 
 * Prerequisites:
 *   - DATABASE_URL must be set
 *   - DNI_ENCRYPTION_KEY must be set (32 bytes)
 *   - Run AFTER prisma migrate dev/deploy has added dniHash column
 * 
 * Rollback:
 *   - Worker.dni still stores the encrypted value
 *   - To decrypt: use decrypt() function from src/lib/encryption.ts
 *   - Then UPDATE Worker SET dni = decrypted_value, dniHash = NULL
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { encrypt, hash } from '../src/lib/encryption'

const prisma = new PrismaClient()

async function migrateDniEncryption() {
  console.log('🔐 Starting DNI encryption migration...')
  
  // Verify env vars
  if (!process.env.DNI_ENCRYPTION_KEY) {
    console.error('❌ DNI_ENCRYPTION_KEY is not set')
    process.exit(1)
  }
  
  if (process.env.DNI_ENCRYPTION_KEY.length !== 32) {
    console.error(`❌ DNI_ENCRYPTION_KEY must be exactly 32 bytes, got ${process.env.DNI_ENCRYPTION_KEY.length}`)
    process.exit(1)
  }
  
  // Find all workers with plaintext DNI (those without ':' separator = not encrypted)
  // We identify plaintext DNIs as those that look like Spanish DNIs (8 digits + letter)
  const workers = await prisma.$queryRaw<Array<{ id: string; dni: string; organizationId: string }>>`
    SELECT id, dni, "organizationId" 
    FROM "Worker" 
    WHERE dni IS NOT NULL 
      AND dni != '' 
      AND dni NOT LIKE '%:%'
      AND dni ~ '^\\d{8}[A-Z]$'
  `
  
  console.log(`📋 Found ${workers.length} workers with plaintext DNI to migrate...`)
  
  if (workers.length === 0) {
    console.log('✅ No workers to migrate. All DNIs may already be encrypted.')
    return
  }
  
  let migrated = 0
  let errors = 0
  
  for (const worker of workers) {
    try {
      const plaintextDni = worker.dni
      
      // Encrypt and hash
      const encryptedDni = encrypt(plaintextDni)
      const dniHashValue = hash(plaintextDni)
      
      // Update the worker record
      await prisma.worker.update({
        where: { id: worker.id },
        data: {
          dni: encryptedDni,
          dniHash: dniHashValue,
        },
      })
      
      migrated++
      console.log(`  ✅ Worker ${worker.id}: ${plaintextDni} → encrypted`)
    } catch (error) {
      errors++
      console.error(`  ❌ Worker ${worker.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  console.log(`\n📊 Migration complete:`)
  console.log(`  ✅ Migrated: ${migrated}`)
  console.log(`  ❌ Errors: ${errors}`)
  
  if (errors > 0) {
    console.warn('\n⚠️  Some workers failed to migrate. Check the errors above.')
  } else {
    console.log('\n🎉 All workers migrated successfully!')
  }
}

// Also check for already-encrypted workers (with ':' in dni) that might be missing dniHash
async function backfillDniHash() {
  console.log('\n🔄 Checking for encrypted workers missing dniHash...')
  
  const workersMissingHash = await prisma.worker.findMany({
    where: {
      dni: {
        contains: ':', // encrypted format has ':' separator
      },
      dniHash: null,
    },
    select: {
      id: true,
      dni: true,
    },
  })
  
  console.log(`📋 Found ${workersMissingHash.length} encrypted workers missing dniHash...`)
  
  let updated = 0
  for (const worker of workersMissingHash) {
    try {
      // Decrypt to get plaintext, then compute hash
      const { decrypt, hash: computeHash } = await import('../src/lib/encryption')
      const plaintextDni = decrypt(worker.dni)
      const dniHashValue = computeHash(plaintextDni)
      
      await prisma.worker.update({
        where: { id: worker.id },
        data: { dniHash: dniHashValue },
      })
      updated++
      console.log(`  ✅ Worker ${worker.id}: backfilled dniHash`)
    } catch (error) {
      console.error(`  ❌ Worker ${worker.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  console.log(`  ✅ Backfilled: ${updated}`)
}

// Run both migrations
migrateDniEncryption()
  .then(() => backfillDniHash())
  .then(() => {
    console.log('\n✅ DNI encryption migration completed.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
