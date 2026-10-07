// All reference DDL runs on a separate disposable database in the same proved
// server. Historical September SQL, not fresh-install SQL, defines expectations.
export const TABLES = ['DailyPayDay', 'DailyPayMonthControl', 'WorkerDayOperation', 'WorkerDayTruckSegment'];
export const CHECKS = ['daily_pay_month_status_paid_at_consistency', 'worker_daily_rate_positive', 'worker_day_company_name_nonempty', 'worker_day_segment_kilometers_nonnegative', 'worker_day_segment_position_range', 'worker_day_segment_share_range'];
export const INDEXES = [
  'DailyPayDay_organizationId_idx', 'DailyPayDay_pkey', 'DailyPayDay_workDate_idx', 'DailyPayDay_workerId_idx', 'DailyPayDay_workerId_workDate_key',
  'DailyPayMonthControl_organizationId_idx', 'DailyPayMonthControl_organizationId_workerId_periodStart_key', 'DailyPayMonthControl_pkey', 'DailyPayMonthControl_workerId_idx',
  'WorkerDayOperation_dailyPayDayId_key', 'WorkerDayOperation_organizationId_idx', 'WorkerDayOperation_pkey',
  'WorkerDayTruckSegment_operationId_idx', 'WorkerDayTruckSegment_operationId_position_key', 'WorkerDayTruckSegment_organizationId_idx', 'WorkerDayTruckSegment_pkey', 'WorkerDayTruckSegment_truckId_workDate_key',
];
export const FOREIGN_KEYS = [
  'DailyPayDay_organizationId_fkey', 'DailyPayDay_workerId_fkey',
  'DailyPayMonthControl_organizationId_fkey', 'DailyPayMonthControl_workerId_fkey',
  'WorkerDayOperation_dailyPayDayId_fkey', 'WorkerDayOperation_organizationId_fkey',
  'WorkerDayTruckSegment_operationId_fkey', 'WorkerDayTruckSegment_organizationId_fkey', 'WorkerDayTruckSegment_truckId_fkey',
];
export const REFERENCE_BASE = `CREATE TABLE public."Worker" ("id" TEXT PRIMARY KEY);
CREATE TABLE public."Organization" ("id" TEXT PRIMARY KEY);
CREATE TABLE public."Truck" ("id" TEXT PRIMARY KEY);
CREATE TYPE public."AuditAction" AS ENUM ('DATA_EXPORT','DATA_DELETE_REQUEST','ORG_UPDATE','ROLE_CHANGE','PLATFORM_ADMIN_WRITE','CONSENT_CHANGE','PASSWORD_CHANGE','TWO_FACTOR_CHANGE');\n`;
export const VALIDATE_SQL = `DO $r4$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT conrelid::regclass AS rel, conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype IN ('f','c') ORDER BY conrelid, conname
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.rel, c.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s NOT VALID', c.rel, c.conname, c.def);
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.rel, c.conname);
  END LOOP;
END $r4$;\n`;
export const LEDGER_SQL = `SELECT migration_name || '|' || checksum || '|' || (finished_at IS NOT NULL)::text || '|' || (rolled_back_at IS NULL)::text || '|' || applied_steps_count::text FROM public._prisma_migrations ORDER BY migration_name;\n`;
const literals = values => values.map(v => `'${v}'`).join(',');
const tables = literals(TABLES);
export const CATALOG_SQL = `SELECT json_build_object(
'columns', (SELECT json_agg(row_to_json(v) ORDER BY v.table_name,v.ordinal_position) FROM
 (SELECT table_name,column_name,CASE WHEN table_name='Worker' THEN 0 ELSE ordinal_position END AS ordinal_position,data_type,udt_name,is_nullable,column_default,numeric_precision,numeric_scale,character_maximum_length,datetime_precision
 FROM information_schema.columns WHERE table_schema='public' AND (table_name IN (${tables}) OR table_name='Worker' AND column_name='dailyRate')) v),
'indexes', (SELECT json_agg(row_to_json(v) ORDER BY v.indexname COLLATE "C") FROM
 (SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN (${tables})) v),
'constraints', (SELECT json_agg(row_to_json(v) ORDER BY v.relation,v.name COLLATE "C") FROM
 (SELECT t.relname AS relation,c.conname AS name,c.contype AS type,c.convalidated AS validated,pg_get_constraintdef(c.oid) AS definition
 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE c.connamespace='public'::regnamespace
 AND (t.relname IN (${tables}) OR t.relname='Worker' AND c.conname='worker_daily_rate_positive')) v),
'checks', (SELECT json_agg(c.conname::text ORDER BY c.conname::text COLLATE "C") FROM pg_constraint c WHERE c.connamespace='public'::regnamespace AND c.contype='c'),
'enums', (SELECT json_agg(row_to_json(v) ORDER BY v.name,v.position) FROM
 (SELECT t.typname AS name,e.enumlabel AS value,e.enumsortorder AS position FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
 WHERE t.typnamespace='public'::regnamespace AND t.typname IN ('DailyPayMonthStatus','AuditAction')) v),
'valid', (SELECT count(*)=0 FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype IN ('f','c') AND NOT convalidated),
'noPayment', to_regclass('public."DailyPayPayment"') IS NULL);\n`;
export const OCTOBER_CATALOG_SQL = `SELECT json_build_object(
'columns', (SELECT json_agg(row_to_json(v)) FROM (SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='TruckMileage' AND column_name='sourceWorkerDaySegmentId') v),
'indexes', (SELECT json_agg(row_to_json(v)) FROM (SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='TruckMileage' AND indexname='TruckMileage_sourceWorkerDaySegmentId_key') v),
'constraints', (SELECT json_agg(row_to_json(v)) FROM (SELECT c.conname AS name,c.contype AS type,c.convalidated AS validated,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname='TruckMileage' AND c.conname='TruckMileage_sourceWorkerDaySegmentId_fkey') v));\n`;
const refuse = () => { throw new Error('catalog-or-ledger-refused'); };
export function assertOctoberCatalog(actual) {
  const column = actual?.columns, index = actual?.indexes, fk = actual?.constraints;
  if (!Array.isArray(column) || column.length !== 1 || JSON.stringify(column[0]) !== JSON.stringify({ column_name: 'sourceWorkerDaySegmentId', data_type: 'text', is_nullable: 'YES' }) ||
      !Array.isArray(index) || index.length !== 1 || index[0].indexname !== 'TruckMileage_sourceWorkerDaySegmentId_key' ||
      index[0].indexdef !== 'CREATE UNIQUE INDEX "TruckMileage_sourceWorkerDaySegmentId_key" ON public."TruckMileage" USING btree ("sourceWorkerDaySegmentId")' ||
      !Array.isArray(fk) || fk.length !== 1 || fk[0].name !== 'TruckMileage_sourceWorkerDaySegmentId_fkey' || fk[0].type !== 'f' || fk[0].validated !== true ||
      fk[0].definition !== 'FOREIGN KEY ("sourceWorkerDaySegmentId") REFERENCES "WorkerDayTruckSegment"(id) ON UPDATE CASCADE ON DELETE CASCADE') refuse();
}
export function assertCatalog(actual, reference) {
  if (!actual || actual.valid !== true || actual.noPayment !== true || JSON.stringify(actual) !== JSON.stringify(reference)) refuse();
  if (JSON.stringify(actual.checks) !== JSON.stringify(CHECKS) ||
      JSON.stringify(actual.indexes?.map(v => v.indexname)) !== JSON.stringify(INDEXES) ||
      JSON.stringify(actual.constraints?.filter(v => v.type === 'f').map(v => v.name).sort()) !== JSON.stringify(FOREIGN_KEYS) ||
      actual.constraints?.filter(v => v.type === 'c' && v.validated).length !== 6) refuse();
}
export function assertLedger(text, pins, final = false) {
  const names = Object.keys(pins).slice(0, final ? 7 : 3);
  const rows = text.trim().split(/\r?\n/);
  if (rows.length !== names.length) refuse();
  for (let i = 0; i < names.length; i++) {
    const name = names[i], steps = i === 3 || i === 4 ? '0' : '1';
    if (rows[i] !== `${name}|${pins[name]}|true|true|${steps}`) refuse();
  }
}
