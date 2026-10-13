BEGIN;
-- Preserve legacy payrolls: null dates retain their calendar-month meaning.
ALTER TABLE "Payroll" ADD COLUMN "periodStart" DATE, ADD COLUMN "periodEnd" DATE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_period_dates_check" CHECK (
  ("periodStart" IS NULL AND "periodEnd" IS NULL) OR
  ("periodStart" IS NOT NULL AND "periodEnd" IS NOT NULL AND "periodStart" <= "periodEnd")
);
DROP INDEX "Payroll_workerId_month_year_key";
CREATE INDEX "Payroll_workerId_month_year_idx" ON "Payroll"("workerId", "month", "year");
COMMIT;
