const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

// Usa la variable de entorno 
const prisma = new PrismaClient()

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