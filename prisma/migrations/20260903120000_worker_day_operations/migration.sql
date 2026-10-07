CREATE TABLE "WorkerDayOperation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dailyPayDayId" TEXT NOT NULL,
  "companyName" VARCHAR(160) NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkerDayOperation_dailyPayDayId_fkey" FOREIGN KEY ("dailyPayDayId") REFERENCES "DailyPayDay"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkerDayOperation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "worker_day_company_name_nonempty" CHECK (length(btrim("companyName")) > 0)
);
CREATE UNIQUE INDEX "WorkerDayOperation_dailyPayDayId_key" ON "WorkerDayOperation"("dailyPayDayId");
CREATE INDEX "WorkerDayOperation_organizationId_idx" ON "WorkerDayOperation"("organizationId");

CREATE TABLE "WorkerDayTruckSegment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "operationId" TEXT NOT NULL,
  "truckId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "position" INTEGER NOT NULL,
  "share" INTEGER NOT NULL,
  "kilometers" DECIMAL(12,2),
  "incident" VARCHAR(1000),
  "organizationId" TEXT NOT NULL,
  CONSTRAINT "WorkerDayTruckSegment_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "WorkerDayOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkerDayTruckSegment_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkerDayTruckSegment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "worker_day_segment_position_range" CHECK ("position" BETWEEN 1 AND 2),
  CONSTRAINT "worker_day_segment_share_range" CHECK ("share" BETWEEN 1 AND 100),
  CONSTRAINT "worker_day_segment_kilometers_nonnegative" CHECK ("kilometers" IS NULL OR "kilometers" >= 0)
);
CREATE UNIQUE INDEX "WorkerDayTruckSegment_truckId_workDate_key" ON "WorkerDayTruckSegment"("truckId", "workDate");
CREATE UNIQUE INDEX "WorkerDayTruckSegment_operationId_position_key" ON "WorkerDayTruckSegment"("operationId", "position");
CREATE INDEX "WorkerDayTruckSegment_operationId_idx" ON "WorkerDayTruckSegment"("operationId");
CREATE INDEX "WorkerDayTruckSegment_organizationId_idx" ON "WorkerDayTruckSegment"("organizationId");
