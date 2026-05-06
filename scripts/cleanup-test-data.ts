import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanup() {
  console.log('🧹 Limpiando datos de prueba...')

  // Borrar nóminas primero (dependen de workers)
  const deletedPayrolls = await prisma.payroll.deleteMany({})
  console.log(`✅ Borradas ${deletedPayrolls.count} nóminas`)

  // Borrar workers
  const deletedWorkers = await prisma.worker.deleteMany({})
  console.log(`✅ Borrados ${deletedWorkers.count} trabajadores`)

  // Borrar transactions (dependen de trucks)
  const deletedTransactions = await prisma.transaction.deleteMany({})
  console.log(`✅ Borradas ${deletedTransactions.count} transacciones`)

  // Borrar trucks
  const deletedTrucks = await prisma.truck.deleteMany({})
  console.log(`✅ Borrados ${deletedTrucks.count} camiones`)

  console.log('\n🎉 ¡Listo! Tu base de datos está limpia.')
  console.log('Ahora podés crear nuevos trabajadores con la nueva clave de cifrado.')
}

cleanup()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
