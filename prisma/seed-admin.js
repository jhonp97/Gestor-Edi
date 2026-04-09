const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

// Hardcode the connection for seeding
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.fifaolmsgghwsaktdffe:4400453641861814@aws-1-eu-west-2.pooler.supabase.com:5432/postgres'
    }
  }
})

async function main() {
  console.log('🌱 Creating admin user...')

  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@flota.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  })
  
  console.log(`✅ Admin created: ${admin.email}`)
  console.log(`   Password: admin123`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())