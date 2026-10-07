-- CreateEnum
CREATE TYPE "TruckStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ORG_ADMIN', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "TwoFactorMethod" AS ENUM ('NONE', 'SMS');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('DATA_EXPORT', 'DATA_DELETE_REQUEST', 'ORG_UPDATE', 'ROLE_CHANGE', 'PLATFORM_ADMIN_WRITE', 'CONSENT_CHANGE', 'PASSWORD_CHANGE', 'TWO_FACTOR_CHANGE', 'DAILY_PAY_MONTH_MARKED_PAID', 'DAILY_PAY_MONTH_MARKED_PENDING');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "DailyPayMonthStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "Truck" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "TruckStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "dniHash" TEXT,
    "docType" TEXT NOT NULL DEFAULT 'DNI',
    "position" TEXT NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "dailyRate" DECIMAL(12,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "truckId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "irpfPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "irpfAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "socialSecurityPercent" DOUBLE PRECISION NOT NULL DEFAULT 6.35,
    "socialSecurityAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductionsDesc" TEXT,
    "bonuses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusesDesc" TEXT,
    "grossPay" DOUBLE PRECISION NOT NULL,
    "netPay" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruckMileage" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "km" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "TruckMileage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "planType" "PlanType" NOT NULL DEFAULT 'FREE',
    "planStatus" "PlanStatus" NOT NULL DEFAULT 'TRIAL',
    "billingEmail" TEXT,
    "billingVatId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "categories" JSONB NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "image" TEXT,
    "phone" TEXT,
    "phoneVerified" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorMethod" "TwoFactorMethod" NOT NULL DEFAULT 'NONE',
    "language" TEXT NOT NULL DEFAULT 'es',
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "gdprConsentGiven" BOOLEAN NOT NULL DEFAULT false,
    "gdprConsentDate" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletionRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPayDay" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "rateSnapshot" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "DailyPayDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerDayOperation" (
    "id" TEXT NOT NULL,
    "dailyPayDayId" TEXT NOT NULL,
    "companyName" VARCHAR(160) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerDayOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerDayTruckSegment" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "position" INTEGER NOT NULL,
    "share" INTEGER NOT NULL,
    "kilometers" DECIMAL(12,2),
    "incident" VARCHAR(1000),
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "WorkerDayTruckSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPayMonthControl" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "status" "DailyPayMonthStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "DailyPayMonthControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Truck_status_idx" ON "Truck"("status");

-- CreateIndex
CREATE INDEX "Truck_plate_idx" ON "Truck"("plate");

-- CreateIndex
CREATE INDEX "Truck_organizationId_idx" ON "Truck"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_plate_organizationId_key" ON "Truck"("plate", "organizationId");

-- CreateIndex
CREATE INDEX "Transaction_truckId_idx" ON "Transaction"("truckId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_idx" ON "Transaction"("organizationId");

-- CreateIndex
CREATE INDEX "Worker_status_idx" ON "Worker"("status");

-- CreateIndex
CREATE INDEX "Worker_dni_idx" ON "Worker"("dni");

-- CreateIndex
CREATE INDEX "Worker_dniHash_idx" ON "Worker"("dniHash");

-- CreateIndex
CREATE INDEX "Worker_truckId_idx" ON "Worker"("truckId");

-- CreateIndex
CREATE INDEX "Worker_organizationId_idx" ON "Worker"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_dniHash_organizationId_key" ON "Worker"("dniHash", "organizationId");

-- CreateIndex
CREATE INDEX "Payroll_workerId_idx" ON "Payroll"("workerId");

-- CreateIndex
CREATE INDEX "Payroll_month_year_idx" ON "Payroll"("month", "year");

-- CreateIndex
CREATE INDEX "Payroll_organizationId_idx" ON "Payroll"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_workerId_month_year_key" ON "Payroll"("workerId", "month", "year");

-- CreateIndex
CREATE INDEX "TruckMileage_truckId_idx" ON "TruckMileage"("truckId");

-- CreateIndex
CREATE INDEX "TruckMileage_date_idx" ON "TruckMileage"("date");

-- CreateIndex
CREATE INDEX "TruckMileage_organizationId_idx" ON "TruckMileage"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TruckMileage_truckId_date_key" ON "TruckMileage"("truckId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_ownerId_key" ON "Organization"("ownerId");

-- CreateIndex
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");

-- CreateIndex
CREATE INDEX "ConsentLog_userId_idx" ON "ConsentLog"("userId");

-- CreateIndex
CREATE INDEX "ConsentLog_organizationId_idx" ON "ConsentLog"("organizationId");

-- CreateIndex
CREATE INDEX "ConsentLog_createdAt_idx" ON "ConsentLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "DailyPayDay_workerId_idx" ON "DailyPayDay"("workerId");

-- CreateIndex
CREATE INDEX "DailyPayDay_workDate_idx" ON "DailyPayDay"("workDate");

-- CreateIndex
CREATE INDEX "DailyPayDay_organizationId_idx" ON "DailyPayDay"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPayDay_workerId_workDate_key" ON "DailyPayDay"("workerId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerDayOperation_dailyPayDayId_key" ON "WorkerDayOperation"("dailyPayDayId");

-- CreateIndex
CREATE INDEX "WorkerDayOperation_organizationId_idx" ON "WorkerDayOperation"("organizationId");

-- CreateIndex
CREATE INDEX "WorkerDayTruckSegment_operationId_idx" ON "WorkerDayTruckSegment"("operationId");

-- CreateIndex
CREATE INDEX "WorkerDayTruckSegment_organizationId_idx" ON "WorkerDayTruckSegment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerDayTruckSegment_truckId_workDate_key" ON "WorkerDayTruckSegment"("truckId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerDayTruckSegment_operationId_position_key" ON "WorkerDayTruckSegment"("operationId", "position");

-- CreateIndex
CREATE INDEX "DailyPayMonthControl_workerId_idx" ON "DailyPayMonthControl"("workerId");

-- CreateIndex
CREATE INDEX "DailyPayMonthControl_organizationId_idx" ON "DailyPayMonthControl"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPayMonthControl_organizationId_workerId_periodStart_key" ON "DailyPayMonthControl"("organizationId", "workerId", "periodStart");

-- AddForeignKey
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckMileage" ADD CONSTRAINT "TruckMileage_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckMileage" ADD CONSTRAINT "TruckMileage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPayDay" ADD CONSTRAINT "DailyPayDay_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPayDay" ADD CONSTRAINT "DailyPayDay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerDayOperation" ADD CONSTRAINT "WorkerDayOperation_dailyPayDayId_fkey" FOREIGN KEY ("dailyPayDayId") REFERENCES "DailyPayDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerDayOperation" ADD CONSTRAINT "WorkerDayOperation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerDayTruckSegment" ADD CONSTRAINT "WorkerDayTruckSegment_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "WorkerDayOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerDayTruckSegment" ADD CONSTRAINT "WorkerDayTruckSegment_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerDayTruckSegment" ADD CONSTRAINT "WorkerDayTruckSegment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPayMonthControl" ADD CONSTRAINT "DailyPayMonthControl_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPayMonthControl" ADD CONSTRAINT "DailyPayMonthControl_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Custom CHECK constraints from the unchanged historical migration chain.
ALTER TABLE "Worker" ADD CONSTRAINT "worker_daily_rate_positive" CHECK ("dailyRate" IS NULL OR "dailyRate" > 0);
ALTER TABLE "DailyPayMonthControl" ADD CONSTRAINT "daily_pay_month_status_paid_at_consistency" CHECK (("status" = 'PAID' AND "paidAt" IS NOT NULL) OR ("status" = 'PENDING' AND "paidAt" IS NULL));
ALTER TABLE "WorkerDayOperation" ADD CONSTRAINT "worker_day_company_name_nonempty" CHECK (length(btrim("companyName")) > 0);
ALTER TABLE "WorkerDayTruckSegment" ADD CONSTRAINT "worker_day_segment_position_range" CHECK ("position" BETWEEN 1 AND 2);
ALTER TABLE "WorkerDayTruckSegment" ADD CONSTRAINT "worker_day_segment_share_range" CHECK ("share" BETWEEN 1 AND 100);
ALTER TABLE "WorkerDayTruckSegment" ADD CONSTRAINT "worker_day_segment_kilometers_nonnegative" CHECK ("kilometers" IS NULL OR "kilometers" >= 0);
