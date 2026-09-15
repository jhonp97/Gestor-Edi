-- TM-PROC fingerprint gate: this migration amends the pending daily-pay change
-- in place and must only run on targets where the payment ledger was never
-- created (design: fingerprint first; a wrong or previously-migrated target
-- stops before any DDL is executed).
DO $$
BEGIN
  IF to_regclass('public."DailyPayPayment"') IS NOT NULL THEN
    RAISE EXCEPTION 'Migration guard failed: table "DailyPayPayment" exists on this database. This migration amends the pending change in place and must only run on targets where the payment ledger was never created. Aborting before any DDL.';
  END IF;
END
$$;

-- CreateEnum
CREATE TYPE "DailyPayMonthStatus" AS ENUM ('PENDING', 'PAID');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'DAILY_PAY_MONTH_MARKED_PAID';
ALTER TYPE "AuditAction" ADD VALUE 'DAILY_PAY_MONTH_MARKED_PENDING';

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN "dailyRate" DECIMAL(12,2);

-- Positive daily-rate invariant: the rate MAY be absent (NULL) and MUST be
-- positive when configured (spec: worker-daily-pay-accrual).
ALTER TABLE "Worker" ADD CONSTRAINT "worker_daily_rate_positive" CHECK ("dailyRate" IS NULL OR "dailyRate" > 0);

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
CREATE TABLE "DailyPayMonthControl" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "status" "DailyPayMonthStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "DailyPayMonthControl_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "daily_pay_month_status_paid_at_consistency" CHECK (
      ("status" = 'PAID' AND "paidAt" IS NOT NULL) OR
      ("status" = 'PENDING' AND "paidAt" IS NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyPayDay_workerId_workDate_key" ON "DailyPayDay"("workerId", "workDate");

-- CreateIndex
CREATE INDEX "DailyPayDay_workerId_idx" ON "DailyPayDay"("workerId");

-- CreateIndex
CREATE INDEX "DailyPayDay_workDate_idx" ON "DailyPayDay"("workDate");

-- CreateIndex
CREATE INDEX "DailyPayDay_organizationId_idx" ON "DailyPayDay"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPayMonthControl_organizationId_workerId_periodStart_key" ON "DailyPayMonthControl"("organizationId", "workerId", "periodStart");

-- CreateIndex
CREATE INDEX "DailyPayMonthControl_workerId_idx" ON "DailyPayMonthControl"("workerId");

-- CreateIndex
CREATE INDEX "DailyPayMonthControl_organizationId_idx" ON "DailyPayMonthControl"("organizationId");

-- AddForeignKey
ALTER TABLE "DailyPayDay" ADD CONSTRAINT "DailyPayDay_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPayDay" ADD CONSTRAINT "DailyPayDay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPayMonthControl" ADD CONSTRAINT "DailyPayMonthControl_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPayMonthControl" ADD CONSTRAINT "DailyPayMonthControl_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
