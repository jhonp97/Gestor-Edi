import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting tenancy migration...')

  const nullOrgUsers = await prisma.user.findMany({
    where: { organizationId: null },
    include: { ownedOrganization: true },
  })

  const allOrgs = await prisma.organization.findMany({ select: { id: true } })
  const validOrgIds = new Set(allOrgs.map(o => o.id))

  const usersWithStaleOrgId = await prisma.user.findMany({
    where: {
      organizationId: { not: null },
    },
    include: { ownedOrganization: true },
  })

  const staleOrgUsers = usersWithStaleOrgId.filter(u => !validOrgIds.has(u.organizationId!))
  const allUsersToFix = [...nullOrgUsers, ...staleOrgUsers]

  console.log(`Found ${nullOrgUsers.length} users without organization and ${staleOrgUsers.length} users with stale organizationId`)

  const totalToFix = allUsersToFix.length
  if (totalToFix === 0) {
    console.log('All users have valid organizations')
  }

  for (const user of allUsersToFix) {
    // Skip if ownedOrganization exists and is valid
    if (user.ownedOrganization && validOrgIds.has(user.organizationId!)) continue
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
