import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Enums hardcoded for seed (compatible with PostgreSQL)
const TruckStatus = {
  ACTIVE: 'ACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  INACTIVE: 'INACTIVE',
} as const

const TransactionType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const

const WorkerStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ON_LEAVE: 'ON_LEAVE',
} as const

const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clean existing data
  await prisma.payroll.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.worker.deleteMany()
  await prisma.truck.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.user.deleteMany()
  console.log('🗑️  Cleaned existing data')

  // --- Admin User ---
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@flota.com',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  })
  console.log(`✅ Created admin user: ${admin.email}`)

  // --- Trucks ---
  const truck1 = await prisma.truck.create({
    data: {
      plate: 'ABC-1234',
      brand: 'Volvo',
      model: 'FH16',
      year: 2022,
      status: TruckStatus.ACTIVE,
    },
  })

  const truck2 = await prisma.truck.create({
    data: {
      plate: 'DEF-5678',
      brand: 'Scania',
      model: 'R500',
      year: 2021,
      status: TruckStatus.ACTIVE,
    },
  })

  const truck3 = await prisma.truck.create({
    data: {
      plate: 'GHI-9012',
      brand: 'Mercedes-Benz',
      model: 'Actros',
      year: 2020,
      status: TruckStatus.MAINTENANCE,
    },
  })

  console.log(`✅ Created ${truck1.plate}, ${truck2.plate}, ${truck3.plate}`)

  // --- Transactions for Truck 1 (Volvo) ---
  await prisma.transaction.createMany({
    data: [
      {
        truckId: truck1.id,
        type: TransactionType.EXPENSE,
        amount: 250.0,
        description: 'Carga de combustible',
        date: new Date('2025-09-01'),
        category: 'Gasolina',
      },
      {
        truckId: truck1.id,
        type: TransactionType.EXPENSE,
        amount: 45.0,
        description: 'Peaje ruta 9',
        date: new Date('2025-09-05'),
        category: 'Peajes',
      },
      {
        truckId: truck1.id,
        type: TransactionType.INCOME,
        amount: 1500.0,
        description: 'Viaje Buenos Aires - Rosario',
        date: new Date('2025-09-10'),
        category: 'Viaje',
      },
      {
        truckId: truck1.id,
        type: TransactionType.EXPENSE,
        amount: 320.0,
        description: 'Cambio de frenos',
        date: new Date('2025-09-15'),
        category: 'Reparaciones',
      },
      {
        truckId: truck1.id,
        type: TransactionType.EXPENSE,
        amount: 180.0,
        description: 'Carga de combustible',
        date: new Date('2025-09-20'),
        category: 'Gasolina',
      },
      {
        truckId: truck1.id,
        type: TransactionType.INCOME,
        amount: 2200.0,
        description: 'Viaje Córdoba - Mendoza',
        date: new Date('2025-09-25'),
        category: 'Viaje',
      },
      {
        truckId: truck1.id,
        type: TransactionType.EXPENSE,
        amount: 500.0,
        description: 'Service 50.000 km',
        date: new Date('2025-09-28'),
        category: 'Mantenimiento',
      },
    ],
  })

  // --- Transactions for Truck 2 (Scania) ---
  await prisma.transaction.createMany({
    data: [
      {
        truckId: truck2.id,
        type: TransactionType.EXPENSE,
        amount: 270.0,
        description: 'Carga de combustible',
        date: new Date('2025-09-02'),
        category: 'Gasolina',
      },
      {
        truckId: truck2.id,
        type: TransactionType.INCOME,
        amount: 1800.0,
        description: 'Viaje La Plata - Mar del Plata',
        date: new Date('2025-09-07'),
        category: 'Viaje',
      },
      {
        truckId: truck2.id,
        type: TransactionType.EXPENSE,
        amount: 60.0,
        description: 'Peaje autopista',
        date: new Date('2025-09-08'),
        category: 'Peajes',
      },
      {
        truckId: truck2.id,
        type: TransactionType.EXPENSE,
        amount: 450.0,
        description: 'Reemplazo de neumáticos',
        date: new Date('2025-09-12'),
        category: 'Reparaciones',
      },
      {
        truckId: truck2.id,
        type: TransactionType.INCOME,
        amount: 3100.0,
        description: 'Viaje Rosario - Tucumán',
        date: new Date('2025-09-18'),
        category: 'Viaje',
      },
      {
        truckId: truck2.id,
        type: TransactionType.EXPENSE,
        amount: 200.0,
        description: 'Carga de combustible',
        date: new Date('2025-09-22'),
        category: 'Gasolina',
      },
      {
        truckId: truck2.id,
        type: TransactionType.EXPENSE,
        amount: 350.0,
        description: 'Cambio de aceite y filtros',
        date: new Date('2025-09-30'),
        category: 'Mantenimiento',
      },
    ],
  })

  // --- Transactions for Truck 3 (Mercedes-Benz) ---
  await prisma.transaction.createMany({
    data: [
      {
        truckId: truck3.id,
        type: TransactionType.EXPENSE,
        amount: 230.0,
        description: 'Carga de combustible',
        date: new Date('2025-09-03'),
        category: 'Gasolina',
      },
      {
        truckId: truck3.id,
        type: TransactionType.INCOME,
        amount: 1200.0,
        description: 'Viaje Buenos Aires - Santa Fe',
        date: new Date('2025-09-06'),
        category: 'Viaje',
      },
      {
        truckId: truck3.id,
        type: TransactionType.EXPENSE,
        amount: 35.0,
        description: 'Peaje ruta 8',
        date: new Date('2025-09-06'),
        category: 'Peajes',
      },
      {
        truckId: truck3.id,
        type: TransactionType.EXPENSE,
        amount: 780.0,
        description: 'Reparación de transmisión',
        date: new Date('2025-09-14'),
        category: 'Reparaciones',
      },
      {
        truckId: truck3.id,
        type: TransactionType.EXPENSE,
        amount: 600.0,
        description: 'Revisión general y puesta a punto',
        date: new Date('2025-09-20'),
        category: 'Mantenimiento',
      },
      {
        truckId: truck3.id,
        type: TransactionType.EXPENSE,
        amount: 190.0,
        description: 'Carga de combustible',
        date: new Date('2025-09-25'),
        category: 'Gasolina',
      },
    ],
  })

  console.log('✅ Created 20 transactions across 3 trucks')

  // --- Workers ---
  const worker1 = await prisma.worker.create({
    data: {
      name: 'Carlos García',
      dni: '12345678A',
      position: 'Conductor',
      baseSalary: 3200.0,
      startDate: new Date('2023-01-15'),
      status: WorkerStatus.ACTIVE,
      truckId: truck1.id,
    },
  })

  const worker2 = await prisma.worker.create({
    data: {
      name: 'María López',
      dni: '87654321B',
      position: 'Conductora',
      baseSalary: 3100.0,
      startDate: new Date('2023-03-01'),
      status: WorkerStatus.ACTIVE,
      truckId: truck2.id,
    },
  })

  const worker3 = await prisma.worker.create({
    data: {
      name: 'Roberto Fernández',
      dni: '11223344C',
      position: 'Mecánico',
      baseSalary: 2800.0,
      startDate: new Date('2022-06-10'),
      status: WorkerStatus.ACTIVE,
    },
  })

  const worker4 = await prisma.worker.create({
    data: {
      name: 'Ana Martínez',
      dni: '55667788D',
      position: 'Conductora',
      baseSalary: 2900.0,
      startDate: new Date('2024-01-20'),
      status: WorkerStatus.ON_LEAVE,
      truckId: truck3.id,
    },
  })

  console.log(
    `✅ Created workers: ${worker1.name}, ${worker2.name}, ${worker3.name}, ${worker4.name}`
  )

  // --- Payrolls ---
  const SS_PERCENT = 6.35
  const IRPF_PERCENT = 15

  function calcPayroll(baseSalary: number) {
    const irpfAmount = Math.round(baseSalary * (IRPF_PERCENT / 100) * 100) / 100
    const ssAmount = Math.round(baseSalary * (SS_PERCENT / 100) * 100) / 100
    const grossPay = baseSalary
    const netPay = Math.round((grossPay - irpfAmount - ssAmount) * 100) / 100
    return { irpfAmount, ssAmount, grossPay, netPay }
  }

  // Payroll for October 2025 — active workers
  const payrollData = [
    { workerId: worker1.id, month: 10, year: 2025, baseSalary: worker1.baseSalary },
    { workerId: worker2.id, month: 10, year: 2025, baseSalary: worker2.baseSalary },
    { workerId: worker3.id, month: 10, year: 2025, baseSalary: worker3.baseSalary },
  ]

  for (const pd of payrollData) {
    const calc = calcPayroll(pd.baseSalary)
    await prisma.payroll.create({
      data: {
        workerId: pd.workerId,
        month: pd.month,
        year: pd.year,
        baseSalary: calc.grossPay,
        irpfPercent: IRPF_PERCENT,
        irpfAmount: calc.irpfAmount,
        socialSecurityPercent: SS_PERCENT,
        socialSecurityAmount: calc.ssAmount,
        otherDeductions: 0,
        grossPay: calc.grossPay,
        netPay: calc.netPay,
        paidAt: pd.workerId === worker1.id ? new Date('2025-10-28') : null,
      },
    })
  }

  console.log('✅ Created 3 payroll records for October 2025')

  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
