-- Reconcile the four September worker-day CHECKs without changing historical migrations.
-- Existing names are accepted only when their parsed definitions match the expected checks.
DO $$
DECLARE
  expected RECORD;
  current_check RECORD;
  target_table regclass;
BEGIN
  -- PostgreSQL renders both expected and installed expressions through the same
  -- catalog printer, avoiding comparisons against hand-written formatting.
  CREATE TEMP TABLE worker_day_check_reference (
    "companyName" VARCHAR(160),
    "position" INTEGER,
    "share" INTEGER,
    "kilometers" DECIMAL(12,2),
    CONSTRAINT "worker_day_company_name_nonempty" CHECK (length(btrim("companyName")) > 0),
    CONSTRAINT "worker_day_segment_position_range" CHECK ("position" BETWEEN 1 AND 2),
    CONSTRAINT "worker_day_segment_share_range" CHECK ("share" BETWEEN 1 AND 100),
    CONSTRAINT "worker_day_segment_kilometers_nonnegative" CHECK ("kilometers" IS NULL OR "kilometers" >= 0)
  ) ON COMMIT DROP;

  FOR expected IN
    SELECT conname, pg_get_constraintdef(oid) AS definition,
      CASE WHEN conname = 'worker_day_company_name_nonempty'
        THEN 'public."WorkerDayOperation"'::regclass
        ELSE 'public."WorkerDayTruckSegment"'::regclass END AS relation
    FROM pg_constraint
    WHERE conrelid = 'pg_temp.worker_day_check_reference'::regclass
  LOOP
    target_table := expected.relation;
    SELECT contype, convalidated, pg_get_constraintdef(oid) AS definition
      INTO current_check
      FROM pg_constraint
      WHERE conrelid = target_table AND conname = expected.conname;

    IF FOUND THEN
      IF current_check.contype <> 'c' OR NOT current_check.convalidated
        OR current_check.definition <> expected.definition THEN
        RAISE EXCEPTION 'Worker-day CHECK drift: % on %', expected.conname, target_table;
      END IF;
    ELSE
      CASE expected.conname
        WHEN 'worker_day_company_name_nonempty' THEN
          ALTER TABLE public."WorkerDayOperation" ADD CONSTRAINT "worker_day_company_name_nonempty"
            CHECK (length(btrim("companyName")) > 0);
        WHEN 'worker_day_segment_position_range' THEN
          ALTER TABLE public."WorkerDayTruckSegment" ADD CONSTRAINT "worker_day_segment_position_range"
            CHECK ("position" BETWEEN 1 AND 2);
        WHEN 'worker_day_segment_share_range' THEN
          ALTER TABLE public."WorkerDayTruckSegment" ADD CONSTRAINT "worker_day_segment_share_range"
            CHECK ("share" BETWEEN 1 AND 100);
        WHEN 'worker_day_segment_kilometers_nonnegative' THEN
          ALTER TABLE public."WorkerDayTruckSegment" ADD CONSTRAINT "worker_day_segment_kilometers_nonnegative"
            CHECK ("kilometers" IS NULL OR "kilometers" >= 0);
      END CASE;
    END IF;
  END LOOP;
END
$$;
