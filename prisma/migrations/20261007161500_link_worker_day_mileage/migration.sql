-- Keep worker-day mileage distinguishable from manual truck readings.
-- Existing TruckMileage rows stay manual (NULL source) and are not backfilled.
ALTER TABLE "TruckMileage"
ADD COLUMN "sourceWorkerDaySegmentId" TEXT;

CREATE UNIQUE INDEX "TruckMileage_sourceWorkerDaySegmentId_key"
ON "TruckMileage"("sourceWorkerDaySegmentId");

ALTER TABLE "TruckMileage"
ADD CONSTRAINT "TruckMileage_sourceWorkerDaySegmentId_fkey"
FOREIGN KEY ("sourceWorkerDaySegmentId")
REFERENCES "WorkerDayTruckSegment"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
