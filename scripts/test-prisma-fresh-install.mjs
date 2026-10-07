import { readFile, writeFile, mkdir, mkdtemp, copyFile, lstat, rm } from 'node:fs/promises';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const FILES = Object.freeze(['schema.prisma', 'migrations/migration_lock.toml', 'migrations/20261005190000_baseline/migration.sql']);
const BASELINE = '20261005190000_baseline';
const SCHEMA_HASH = '13e0c569d07c11bbe4e18f4d6bfd21c39cf97f35f64a51db0a069e3347c8e324';
const SQL_HASH = '6e778d283b1a622b2ac37275f8710fe3c290858975e6c57f41ea8848025e3b2f';
const OWNER = 'edi.verification.owner';
const CHECKS = ['worker_daily_rate_positive', 'daily_pay_month_status_paid_at_consistency', 'worker_day_company_name_nonempty', 'worker_day_segment_position_range', 'worker_day_segment_share_range', 'worker_day_segment_kilometers_nonnegative'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const diagnostics = new WeakMap();
const categories = ['identity', 'ownership', 'cleanup', 'catalog', 'ledger', 'configuration', 'artifact', 'prisma', 'docker', 'inspection', 'allowlist', 'collision', 'readiness', 'verification'];
const choose = (value, allowed) => allowed.includes(value) ? value : null;
const fail = category => {
  const error = new Error(category);
  diagnostics.set(error, { category: choose(category, categories) ?? 'unknown' });
  throw error;
};
const diagnostic = error => diagnostics.get(error) ?? { category: 'unknown' };

const RUNNER_PREFIX = 'EDI_OWNED_RESULT:';
const RUNNER_STEPS = ['config', 'pg-import', 'artifacts', 'connect-primary', 'proof-primary', 'connect-direct', 'proof-direct', 'deploy', 'diff', 'reference-create', 'reference-proof', 'reference-load', 'catalog-target', 'catalog-reference', 'ledger', 'close', 'passed'];
const RUNNER_CATEGORIES = [...categories, 'unknown', 'TypeError', 'pg-sql'];
export function serializeRunnerResult(result) { return `${RUNNER_PREFIX}${JSON.stringify(result)}\n`; }
export function parseRunnerResult(output) {
  if (typeof output !== 'string' || Buffer.byteLength(output) > 256 || !output.startsWith(RUNNER_PREFIX)) return null;
  try {
    const result = JSON.parse(output.slice(RUNNER_PREFIX.length));
    if (!result || Object.keys(result).sort().join(',') !== 'category,ok,step' || typeof result.ok !== 'boolean' || !RUNNER_STEPS.includes(result.step)) return null;
    if (result.ok ? result.step !== 'passed' || result.category !== null : result.step === 'passed' || !RUNNER_CATEGORIES.includes(result.category)) return null;
    // Canonical serialization also rejects duplicate keys, extra whitespace and markers.
    return serializeRunnerResult(result) === output ? result : null;
  } catch { return null; }
}
export async function runnerBoundary(run) {
  let step = 'config';
  try {
    await run(value => { if (!RUNNER_STEPS.includes(value) || value === 'passed') fail('verification'); step = value; });
    if (step !== 'close') fail('verification');
    return { ok: true, step: 'passed', category: null };
  } catch (error) {
    const category = diagnostics.get(error)?.category ?? (error instanceof TypeError ? 'TypeError' : /^[0-9A-Z]{5}$/.test(error?.code) ? 'pg-sql' : 'unknown');
    return { ok: false, step, category };
  }
}
export async function loadPgClient(importer = () => import('pg')) {
  const { default: { Client } } = await importer();
  return Client;
}

// Only native metadata is retained; output and error text never cross this boundary.
export function dockerFailure(result, operation, prepStep = null) {
  const error = new Error('docker');
  const bytes = value => typeof value === 'string' || Buffer.isBuffer(value) ? Buffer.byteLength(value) : null;
  const runner = operation === 'start' ? parseRunnerResult(result.stdout) : null;
  diagnostics.set(error, {
    ...(runner && !runner.ok ? { runner } : {}),
    category: 'docker',
    operation: choose(operation, ['build', 'pull', 'inspect', 'version', 'create', 'run', 'exec', 'cp', 'start', 'rm']),
    prepStep: choose(prepStep, ['files', 'docker-version', 'collision-check', 'build', 'image-check', 'pull-postgres']),
    status: Number.isInteger(result.status) && result.status >= 0 && result.status <= 255 ? result.status : null,
    signal: choose(result.signal, ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGABRT', 'SIGSEGV', 'SIGPIPE', 'SIGHUP', 'SIGQUIT']),
    errorCode: choose(result.error?.code, ['ENOENT', 'EACCES', 'EPERM', 'ETIMEDOUT', 'ENOBUFS', 'EIO', 'ENOMEM', 'EINVAL', 'E2BIG']),
    stdoutBytes: bytes(result.stdout), stderrBytes: bytes(result.stderr),
  });
  return error;
}

export function assertIdentity(actual, expected) {
  for (const field of ['database', 'role', 'address', 'port', 'system']) if (actual[field] !== expected[field]) fail('identity');
  if (actual.objects !== 0) fail('identity');
}
export function assertResource(resource, owner) {
  if (resource.labels?.[OWNER] !== owner || resource.internal === false || resource.ports?.length || resource.mounts?.some(m => m.Type !== 'tmpfs')) fail('ownership');
}
export function cleanupResource(io, type, name) {
  const resource = io.inspect(type, name);
  if (!resource) return;
  const pattern = type === 'image' ? /^sha256:[a-f0-9]{64}$/ : /^(?:[a-f0-9]{64})$/;
  if (!['container', 'network', 'image'].includes(type) || typeof resource.Id !== 'string' || !pattern.test(resource.Id)) fail('ownership');
  const id = resource.Id;
  io.check(type, resource);
  const current = io.inspect(type, id);
  if (!current || current.Id !== id) fail('ownership');
  io.check(type, current);
  io.docker(type === 'container' ? ['container', 'rm', '--force', id] : [type, 'rm', id]);
  if (io.inspect(type, id)) fail('cleanup');
  // A reused name is ambiguous even when the captured object is gone.
  if (io.inspect(type, name)) fail('ownership');
}
export function assertCatalog(actual, expected) {
  const checks = actual.constraints.filter(c => c.type === 'c');
  if (checks.length !== 6 || CHECKS.some(name => !checks.some(c => c.name === name && c.validated === true)) || JSON.stringify(actual) !== JSON.stringify(expected)) fail('catalog');
}
export function assertLedger(rows, checksum) {
  const r = rows[0];
  if (rows.length !== 1 || r.migration_name !== BASELINE || r.checksum !== checksum || r.finished !== true || r.rolled_back !== false || r.applied_steps_count !== 1) fail('ledger');
}
export async function verifyDatabase(io, expected, checksum) {
  // No database write is reachable until BOTH real datasource connections pass.
  assertIdentity(await io.proof('DATABASE_URL'), expected);
  assertIdentity(await io.proof('DIRECT_URL'), expected);
  await io.deploy();
  await io.diff();
  await io.reference();
  assertCatalog(await io.catalog('target'), await io.catalog('reference'));
  assertLedger(await io.ledger(), checksum);
}
export async function runOwned(io) {
  let failure = null, phase = 'prepare', cleanup = 'passed', mainDiagnostic = null, cleanupDiagnostic = null;
  try {
    await io.prepare(); phase = 'provision';
    await io.provision(); phase = 'verify';
    await io.verify();
  } catch (error) { failure = phase; mainDiagnostic = diagnostic(error); }
  finally { try { await io.cleanup(); } catch (error) { cleanup = 'failed'; cleanupDiagnostic = diagnostic(error); } }
  return { ok: failure === null && cleanup === 'passed', failure, cleanup, diagnostic: mainDiagnostic, cleanupDiagnostic };
}

const IDENTITY_SQL = `SELECT current_database() AS database, current_user AS role,
  host(inet_server_addr()) AS address, inet_server_port() AS port,
  (SELECT system_identifier::text FROM pg_control_system()) AS system,
  ((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') +
   (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e') +
   (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'))::int AS objects`;
const CATALOG_SQL = {
  constraints: `SELECT t.relname AS table, c.conname AS name, c.contype AS type, c.convalidated AS validated,
    pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname <> '_prisma_migrations' ORDER BY t.relname,c.conname`,
  indexes: `SELECT tablename AS table, indexname AS name, indexdef AS definition FROM pg_indexes
    WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename,indexname`,
  enums: `SELECT t.typname AS name, e.enumlabel AS value, e.enumsortorder AS position FROM pg_enum e
    JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
  tables: `SELECT table_name AS table, column_name AS column, data_type AS type, udt_name AS udt,
    is_nullable AS nullable, column_default AS default, numeric_precision AS precision, numeric_scale AS scale,
    character_maximum_length AS length FROM information_schema.columns
    WHERE table_schema='public' AND table_name <> '_prisma_migrations' ORDER BY table_name,ordinal_position`,
};

async function ownedRunner(step) {
  let config;
  step('config');
  try { config = JSON.parse(await readFile('/work/owned.json', 'utf8')); }
  catch { fail('configuration'); }
  step('pg-import');
  const Client = await loadPgClient();
  step('artifacts');
  const baseline = await readFile(`/work/prisma/migrations/${BASELINE}/migration.sql`);
  if (hash(baseline) !== SQL_HASH || hash(await readFile('/work/prisma/schema.prisma')) !== SCHEMA_HASH) fail('artifact');
  const connect = async url => {
    const c = new Client({ connectionString: url, connectionTimeoutMillis: 10000, query_timeout: 30000, statement_timeout: 30000 });
    clients.push(c);
    await c.connect(); return c;
  };
  const clients = [];
  const readIdentity = async c => {
    await c.query('BEGIN READ ONLY');
    try { return (await c.query(IDENTITY_SQL)).rows[0]; }
    finally { await c.query('ROLLBACK'); }
  };
  const proof = async key => {
    const primary = key === 'DATABASE_URL';
    step(primary ? 'connect-primary' : 'connect-direct');
    const c = await connect(config.urls[key]);
    step(primary ? 'proof-primary' : 'proof-direct');
    return readIdentity(c);
  };
  const prisma = args => {
    const r = spawnSync('/usr/local/bin/node', ['/work/node_modules/prisma/build/index.js', ...args], {
      cwd: '/work', env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/work', DATABASE_URL: config.urls.DATABASE_URL, DIRECT_URL: config.urls.DIRECT_URL, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
      encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024,
    });
    if (r.status !== 0 || r.error) fail('prisma');
  };
  let reference;
  try {
    await verifyDatabase({ proof,
      deploy: async () => { step('deploy'); prisma(['migrate', 'deploy', '--schema', '/work/prisma/schema.prisma']); },
      diff: async () => { step('diff'); prisma(['migrate', 'diff', '--from-schema-datasource', '/work/prisma/schema.prisma', '--to-schema-datamodel', '/work/prisma/schema.prisma', '--exit-code']); },
      reference: async () => {
        // PostgreSQL itself normalizes expected CHECK/FK/index/enum definitions.
        // This reference lives only in the proved owned server, never a shadow URL.
        step('reference-create');
        const name = `${config.expected.database}_reference`;
        if (!/^[a-z0-9_]+$/.test(name)) fail('identity');
        await clients[1].query(`CREATE DATABASE "${name}"`);
        const url = new URL(config.urls.DIRECT_URL); url.pathname = `/${name}`;
        reference = await connect(url.toString());
        step('reference-proof');
        assertIdentity(await readIdentity(reference), { ...config.expected, database: name });
        step('reference-load');
        await reference.query(baseline.toString('utf8'));
      },
      catalog: async key => {
        step(key === 'target' ? 'catalog-target' : 'catalog-reference');
        const result = {}, c = key === 'target' ? clients[1] : reference;
        for (const [name, sql] of Object.entries(CATALOG_SQL)) result[name] = (await c.query(sql)).rows;
        return result;
      },
      ledger: async () => { step('ledger'); return (await clients[1].query(`SELECT migration_name, checksum, finished_at IS NOT NULL AS finished,
        rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count FROM "_prisma_migrations" ORDER BY migration_name`)).rows; },
    }, config.expected, SQL_HASH);
  } catch (error) {
    // Close every tracked client without replacing the original verification failure.
    await Promise.allSettled(clients.map(c => Promise.resolve().then(() => c.end())));
    throw error;
  }
  step('close');
  const closed = await Promise.allSettled(clients.map(c => Promise.resolve().then(() => c.end())));
  if (closed.some(result => result.status === 'rejected')) fail('verification');
}

async function localRuntime() {
  const owner = randomUUID(), prefix = `edi-baseline-${owner}`;
  const names = { network: `${prefix}-net`, db: `${prefix}-pg`, runner: `${prefix}-runner`, image: `${prefix}:verify` };
  const endpoint = process.platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock';
  let scratch, configDir, expected, prepStep = 'files';
  const attempted = new Set();
  // No ambient Docker context, provider config, proxy, .env or database variables.
  const env = { PATH: process.env.PATH, ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot } : {}) };
  const docker = (args, tolerateAbsent = false) => {
    const r = spawnSync('docker', ['--host', endpoint, ...(configDir ? ['--config', configDir] : []), ...args], {
      env, encoding: 'utf8', timeout: args[0] === 'build' || args[0] === 'pull' ? 600000 : 180000, maxBuffer: 4 * 1024 * 1024,
    });
    if (r.status === 0 && !r.error) return args[0] === 'start' ? r.stdout : r.stdout.trim();
    if (tolerateAbsent && r.status === 1 && !r.error && /No such (container|image|network|object)|not found/i.test(r.stderr)) return null;
    throw dockerFailure(r, args[1] === 'inspect' || args[1] === 'rm' || args[1] === 'create' ? args[1] : args[0], prepStep);
  };
  const inspect = (type, name) => {
    const out = docker([type, 'inspect', name], true);
    if (out === null) return null;
    try { return JSON.parse(out)[0]; }
    catch { fail('inspection'); }
  };
  const check = (type, resource) => {
    assertResource({ labels: resource.Config?.Labels ?? resource.Labels, mounts: resource.Mounts ?? [],
      ports: Object.values(resource.HostConfig?.PortBindings ?? {}).filter(Boolean), internal: type === 'network' ? resource.Internal : undefined }, owner);
    if (type === 'container' && (resource.HostConfig.NetworkMode !== names.network || Object.keys(resource.NetworkSettings.Networks).some(n => n !== names.network))) fail('ownership');
  };
  const source = join(dirname(fileURLToPath(import.meta.url)), '../prisma/fresh-install');
  return runOwned({
    prepare: async () => {
      scratch = await mkdtemp(join(tmpdir(), `${prefix}-`));
      configDir = join(scratch, 'docker-config'); await mkdir(configDir);
      await writeFile(join(configDir, 'config.json'), '{}', { mode: 0o600 });
      const context = join(scratch, 'context'); await mkdir(context);
      for (const file of FILES) {
        if (!(await lstat(join(source, file))).isFile()) fail('allowlist');
        const target = join(context, 'prisma', file); await mkdir(dirname(target), { recursive: true });
        await copyFile(join(source, file), target);
      }
      if (hash(await readFile(join(context, 'prisma/schema.prisma'))) !== SCHEMA_HASH || hash(await readFile(join(context, 'prisma/migrations', BASELINE, 'migration.sql'))) !== SQL_HASH || (await readFile(join(context, 'prisma/migrations/migration_lock.toml'), 'utf8')).trim() !== 'provider = "postgresql"') fail('artifact');
      await writeFile(join(context, 'harness.mjs'), await readFile(fileURLToPath(import.meta.url)));
      await writeFile(join(context, 'package.json'), JSON.stringify({ private: true, dependencies: { prisma: '5.22.0', pg: '8.13.1' } }));
      await writeFile(join(context, 'Dockerfile'), 'FROM node:22.14.0-bookworm-slim\nWORKDIR /work\nRUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*\nCOPY package.json ./\nRUN npm install --omit=dev --no-audit --no-fund\nCOPY prisma ./prisma\nCOPY harness.mjs ./harness.mjs\nENTRYPOINT ["node", "/work/harness.mjs", "--owned-runner"]\n');
      prepStep = 'docker-version';
      docker(['version', '--format', '{{.Server.Version}}']);
      prepStep = 'collision-check';
      for (const [type, name] of [['network', names.network], ['container', names.db], ['container', names.runner], ['image', names.image]]) if (inspect(type, name)) fail('collision');
      attempted.add('image');
      prepStep = 'build';
      docker(['build', '--label', `${OWNER}=${owner}`, '--tag', names.image, context]);
      prepStep = 'image-check';
      check('image', inspect('image', names.image));
      prepStep = 'pull-postgres';
      docker(['pull', 'postgres:16.6-bookworm']);
      prepStep = null;
    },
    provision: async () => {
      attempted.add('network'); docker(['network', 'create', '--internal', '--label', `${OWNER}=${owner}`, names.network]);
      check('network', inspect('network', names.network));
      const role = `u_${owner.replaceAll('-', '')}`, database = `d_${owner.replaceAll('-', '')}`, password = randomBytes(32).toString('hex');
      const credentials = join(scratch, 'postgres.env');
      await writeFile(credentials, `POSTGRES_USER=${role}\nPOSTGRES_DB=${database}\nPOSTGRES_PASSWORD=${password}\n`, { mode: 0o600 });
      attempted.add('db');
      docker(['run', '--detach', '--name', names.db, '--label', `${OWNER}=${owner}`, '--network', names.network, '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid', '--env-file', credentials, 'postgres:16.6-bookworm']);
      const db = inspect('container', names.db); check('container', db);
      let ready = false;
      for (let i = 0; i < 30; i++) {
        // Read-only readiness through the owned server; no broad resource scan.
        const r = spawnSync('docker', ['--host', endpoint, '--config', configDir, 'exec', names.db, 'pg_isready', '-U', role, '-d', database], { env, timeout: 5000, encoding: 'utf8' });
        if (r.status === 0) { ready = true; break; }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!ready) fail('readiness');
      const system = docker(['exec', names.db, 'psql', '-X', '-U', role, '-d', database, '-Atc', 'SELECT system_identifier::text FROM pg_control_system()']);
      expected = { database, role, address: db.NetworkSettings.Networks[names.network].IPAddress, port: 5432, system, objects: 0 };
      const url = `postgresql://${role}:${password}@${names.db}:5432/${database}`;
      const config = join(scratch, 'owned.json');
      await writeFile(config, JSON.stringify({ expected, urls: { DATABASE_URL: url, DIRECT_URL: url } }), { mode: 0o600 });
      attempted.add('runner');
      docker(['create', '--name', names.runner, '--label', `${OWNER}=${owner}`, '--network', names.network, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', names.image]);
      check('container', inspect('container', names.runner));
      docker(['cp', config, `${names.runner}:/work/owned.json`]);
    },
    verify: async () => {
      check('network', inspect('network', names.network));
      check('container', inspect('container', names.db));
      check('container', inspect('container', names.runner));
      // Runner emits no raw Prisma/PG output or credentials, including on failure.
      const result = parseRunnerResult(docker(['start', '--attach', names.runner]));
      if (!result?.ok) fail('verification');
      const runner = inspect('container', names.runner); check('container', runner);
      if (runner.State.ExitCode !== 0) fail('verification');
    },
    cleanup: async () => {
      prepStep = null;
      // An ambiguous inspect/removal stops immediately; never prune or guess.
      for (const [key, type] of [['runner', 'container'], ['db', 'container'], ['network', 'network'], ['image', 'image']]) {
        if (!attempted.has(key)) continue;
        cleanupResource({ inspect, check, docker }, type, names[key]);
      }
      if (scratch) {
        if (!(await lstat(scratch)).isDirectory() || !scratch.startsWith(join(tmpdir(), `${prefix}-`))) fail('ownership');
        await rm(scratch, { recursive: true });
        try { await lstat(scratch); fail('cleanup'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length === 3 && process.argv[2] === '--owned-runner') {
    const result = await runnerBoundary(ownedRunner);
    process.stdout.write(serializeRunnerResult(result));
    if (!result.ok) process.exitCode = 1;
  } else if (process.argv.length === 2) {
    try { const result = await localRuntime(); console.log(JSON.stringify(result)); if (!result.ok) process.exitCode = 1; }
    catch { console.error('Local verification failed before orchestration.'); process.exitCode = 1; }
  } else { console.error('No external targets or options are accepted.'); process.exitCode = 1; }
}
