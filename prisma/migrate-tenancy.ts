import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting tenancy migration...')

  const users = await prisma.user.findMany({
    where: { organizationId: null },
  })

  console.log(`Found ${users.length} users without organization`)

  for (const user of users) {
    const org = await prisma.organization.create({
      data: {
        name: `${user.name}'s Fleet`,
        ownerId: user.id,
      },
    })

    console.log(`Created organization "${org.name}" for user ${user.email}`)

    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: org.id },
    })

    const [truckCount, workerCount, transactionCount, payrollCount] = await Promise.all([
      prisma.truck.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } }),
      prisma.worker.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } }),
      prisma.transaction.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } }),
      prisma.payroll.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } }),
    ])

    console.log(`  Assigned ${truckCount.count} trucks, ${workerCount.count} workers, ${transactionCount.count} transactions, ${payrollCount.count} payrolls`)
  }

  const [unassignedTrucks, unassignedWorkers, unassignedTransactions, unassignedPayrolls] = await Promise.all([
    prisma.truck.count({ where: { organizationId: null } }),
    prisma.worker.count({ where: { organizationId: null } }),
    prisma.transaction.count({ where: { organizationId: null } }),
    prisma.payroll.count({ where: { organizationId: null } }),
  ])

  const totalUnassigned = unassignedTrucks + unassignedWorkers + unassignedTransactions + unassignedPayrolls

  if (totalUnassigned > 0) {
    console.error(`WARNING: ${totalUnassigned} records still without organization!`)
    console.error(`  Trucks: ${unassignedTrucks}, Workers: ${unassignedWorkers}, Transactions: ${unassignedTransactions}, Payrolls: ${unassignedPayrolls}`)
  } else {
    console.log('✅ All records successfully assigned to organizations')
  }

  const orgCount = await prisma.organization.count()
  const userCount = await prisma.user.count()
  console.log(`\nMigration complete!`)
  console.log(`  Organizations: ${orgCount}`)
  console.log(`  Users: ${userCount}`)
  console.log(`  Unassigned records: ${totalUnassigned}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Migration failed:', e)
  process.exit(1)
})
