import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Import-safe contracts shared by the native adapter and in-memory tests.
// Runtime authority is granted only through an explicit CLI run invocation.
export const POSTGRES_IMAGE = 'postgres:17.6-bookworm@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3';
export const OWNER = 'local.edi.r4.run';
export const DUMP_PINS = Object.freeze({
  'schema.sql': [24541, 'ea5295ddf0a18fc776108d225e2ceee804513cb6e7a4edae1504b27cb54dce0b'],
  'data.sql': [57466, '7078419d3c55bb16d5c21bb34b047e730bbf74a0bb446c770ac142977c76acb1'],
});
export const MIGRATION_PINS = Object.freeze({
  '20260409191006_init': 'd4a175ed5fe5eb1a638a7ae0e5496b7a99eebfb698433f76a0ee667b55bf1dd6',
  '20260422182000_make_owner_id_optional': 'e291d5cc38f44ff76603656a0cb347d1570953caccff41fa716d22c6833f5728',
  '20260422230000_add_user_profile_fields': '369c042dd493d3e1280a2e2c67ec12ba847cb319a4035e3bce91d53508ef8253',
  '20260902180000_add_worker_daily_pay': '0b3ce17b5cfaf1446d23ce7499b4f3b0f1a6615ab74cba3cd5739293de289834',
  '20260903120000_worker_day_operations': 'a1b042ee7e3b90e95bc23df26016e83cd8868a54276ed68db38098504a39473f',
  '20260904120000_reconcile_worker_day_checks': 'dfe63f1e4abb60b0763062a309c8f15d6686e32a6c84ed6e5258b1504146213d',
  '20261007161500_link_worker_day_mileage': 'afe7183ba12ba7e030e68a56ddf2bfdfa0e254c8dc4995b06935af1ad7131794',
});
const fail = () => { throw new Error('rehearsal-contract-refused'); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const idPattern = /^[a-f0-9]{64}$/;
export function verifyPinned(bytes, size, checksum) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== size || digest(bytes) !== checksum) fail();
}
export function assertContext(files) {
  const expected = ['Dockerfile', 'package-lock.json', 'package.json'];
  if (!Array.isArray(files) || files.length !== expected.length || [...files].sort().join('|') !== expected.join('|')) fail();
}
export function assertEnvironment(env) {
  const allowed = new Set(['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'DOCKER_CONFIG', 'DOCKER_HOST']);
  if (!env || Object.entries(env).some(([key, value]) => !allowed.has(key) || typeof value !== 'string')) fail();
  if (env.DOCKER_HOST && env.DOCKER_HOST !== 'npipe:////./pipe/docker_engine' && env.DOCKER_HOST !== 'unix:///var/run/docker.sock') fail();
}
export function commandEnvironment(ambient, freshConfig, platform = process.platform) {
  if (typeof freshConfig !== 'string' || !freshConfig) fail();
  const env = {
    DOCKER_CONFIG: freshConfig,
    DOCKER_HOST: platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock',
  };
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
    if (typeof ambient[key] === 'string') env[key] = ambient[key];
  }
  assertEnvironment(env);
  return env;
}
export function assertBaseImage(image) {
  // Digest resolution is a parent-owned public-only pre-runtime task.
  if (typeof image !== 'string' || !/^node:22\.[0-9]+\.[0-9]+-bookworm-slim@sha256:[a-f0-9]{64}$/.test(image)) fail();
}
export function cloneURL(run, password) {
  if (!/^[a-f0-9]{16}$/.test(run) || !/^[a-f0-9]{64}$/.test(password)) fail();
  return `postgresql://postgres:${password}@edi-r4-db-${run}:5432/edi_r4_${run}?schema=public`;
}
export function filterPublicCopy(source, allowedTables) {
  if (typeof source !== 'string' || !source.endsWith('\n') || !Array.isArray(allowedTables)) fail();
  const allowed = new Set(allowedTables), seen = new Set(), out = [];
  let inside = false, include = false;
  for (const line of source.match(/[^\n]*\n/g) ?? []) {
    if (!inside) {
      if (!line.startsWith('COPY ')) continue;
      const publicHeader = /^COPY "public"\."([^"\r\n]+)" \([^\r\n]+\) FROM stdin;\r?\n$/.exec(line);
      if (line.startsWith('COPY "public".') && !publicHeader) fail();
      if (!/^COPY "[^"\r\n]+"\."[^"\r\n]+" \([^\r\n]+\) FROM stdin;\r?\n$/.test(line)) fail();
      inside = true;
      include = Boolean(publicHeader);
      if (include) {
        const table = publicHeader[1];
        if (!allowed.has(table) || seen.has(table)) fail();
        seen.add(table);
        out.push(line);
      }
    } else {
      // COPY rows can resemble SQL; only the exact terminator exits this state.
      if (include) out.push(line);
      if (/^\\\.\r?\n$/.test(line)) { inside = false; include = false; }
    }
  }
  if (inside || !seen.has('_prisma_migrations')) fail();
  return out.join('');
}
export function filterSchema(source, omittedStatements) {
  // Exact enumerated statements only: never a broad CREATE EXTENSION prefix.
  if (!Array.isArray(omittedStatements) || omittedStatements.length !== 5 || new Set(omittedStatements).size !== 5) fail();
  if (omittedStatements.filter(s => /^CREATE EXTENSION IF NOT EXISTS /.test(s)).length !== 4 ||
      !omittedStatements.includes('ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";')) fail();
  const seen = new Set();
  const result = source.split(/\r?\n/).filter(line => {
    if (!omittedStatements.includes(line.trim())) return true;
    if (seen.has(line.trim())) fail();
    seen.add(line.trim());
    return false;
  }).join('\n');
  if (seen.size !== 5) fail();
  return result;
}
export function createBudget(clock = () => performance.now(), workMs = 1200000, cleanupMs = 120000) {
  if (![workMs, cleanupMs].every(v => Number.isFinite(v) && v > 0)) fail();
  let deadline = clock() + workMs, cleaning = false;
  return {
    beginCleanup() { if (!cleaning) { cleaning = true; deadline = clock() + cleanupMs; } },
    cap(requested) {
      const remaining = Math.floor(deadline - clock());
      if (!Number.isFinite(requested) || requested <= 0 || remaining <= 0) fail();
      return Math.min(requested, remaining);
    },
  };
}
function assertOwned(resource, kind, name, run, id = resource?.Id) {
  const labels = kind === 'container' ? resource?.Config?.Labels : resource?.Labels;
  if (!idPattern.test(id ?? '') || resource?.Id !== id || resource.Name !== (kind === 'container' ? '/' : '') + name || labels?.[OWNER] !== run) fail();
}
export function assertIsolation(resource, expected) {
  assertOwned(resource, 'container', expected.name, expected.run, expected.id);
  const host = resource.HostConfig ?? {}, networks = resource.NetworkSettings?.Networks ?? {};
  if (resource.Image !== expected.imageId || resource.Config?.Image !== expected.imageReference ||
      host.LogConfig?.Type !== 'none' || host.ReadonlyRootfs !== true || host.NetworkMode !== expected.networkId && host.NetworkMode !== expected.network ||
      Object.keys(networks).join('|') !== expected.network || networks[expected.network]?.NetworkID !== expected.networkId ||
      Object.keys(host.PortBindings ?? {}).length || Object.values(resource.NetworkSettings?.Ports ?? {}).some(v => v?.length) ||
      host.PublishAllPorts === true || host.Binds?.length || host.Mounts?.length) fail();
  const paths = [...expected.tmpfs].sort();
  if (Object.keys(host.Tmpfs ?? {}).sort().join('|') !== paths.join('|')) fail();
  const system = new Set(['/etc/hosts', '/etc/hostname', '/etc/resolv.conf']);
  if ((resource.Mounts ?? []).some(m => !(m.Type === 'tmpfs' && [...paths, '/dev/shm'].includes(m.Destination)) &&
      !(m.Type === 'bind' && system.has(m.Destination)))) fail();
}
export function assertNetwork(resource, expected, containerIds) {
  assertOwned(resource, 'network', expected.name, expected.run, expected.id);
  if (resource.Internal !== true || resource.Driver !== 'bridge' ||
      Object.keys(resource.Containers ?? {}).sort().join('|') !== [...containerIds].sort().join('|')) fail();
}
export async function cleanupOwned(io, resources, run, budget = createBudget()) {
  budget.beginCleanup();
  let complete = true;
  for (const resource of [...resources].reverse()) {
    if (!resource.attempted) continue;
    try {
      // Recovery is by the exact attempted name only, never global discovery.
      const first = await io.inspect(resource.kind, resource.id ?? resource.name, budget.cap(10000));
      if (first === null) { if (resource.id) fail(); continue; }
      assertOwned(first, resource.kind, resource.name, run, resource.id ?? first.Id);
      const current = await io.inspect(resource.kind, first.Id, budget.cap(10000));
      assertOwned(current, resource.kind, resource.name, run, first.Id);
      if (resource.kind === 'network' && (current.Internal !== true || Object.keys(current.Containers ?? {}).length)) fail();
      await io.remove(first.Id, resource.kind, budget.cap(20000));
    } catch { complete = false; }
  }
  return complete ? 'complete' : 'unknown-stop';
}
export async function reconcileClone(io) {
  await io.ledgerBefore();
  // Source-reviewed September 4 SQL is idempotent: existing constraints must be
  // validated and definition-equal; its ON COMMIT DROP reference is disposable.
  // Each call must use a separate psql transaction/session on the proved clone.
  await io.correctiveSQL();
  await io.proveAllEffects();
  await io.diffOctoberPending();
  for (const migration of Object.keys(MIGRATION_PINS).slice(3, 5)) await io.resolve(migration);
  await io.deploy();
  await io.diff();
  await io.catalog();
  await io.ledgerAfter();
  await io.status();
}
export async function runRehearsal(io) {
  let phase = 'public-build', cleanup = 'unknown-stop', passed = false;
  try {
    // Public-only build completes BEFORE the first private dump read.
    await io.buildPublicSidecar();
    phase = 'provision'; await io.provision();
    phase = 'isolation'; await io.proveIsolationAndFilesystems();
    phase = 'connection'; await io.connectionPreflight();
    phase = 'artifacts'; await io.verifyPrivatePins();
    phase = 'restore'; await io.restorePublicOnlyAndValidateCircularFKs();
    phase = 'reconcile'; await reconcileClone(io);
    passed = true; phase = 'complete';
  } catch { /* Suppress native output, SQL, credentials and arbitrary messages. */ }
  finally { try { cleanup = await io.cleanup(); } catch { cleanup = 'unknown-stop'; } }
  return { phase, passed: passed && cleanup === 'complete', cleanup };
}
export function parseArguments(args) {
  const keys = { '--repository': 'repository', '--artifacts': 'artifacts', '--public-inputs': 'publicInputs', '--node-image': 'nodeImage', '--package-sha256': 'packageHash', '--lock-sha256': 'lockHash', '--omit-sql-json': 'omittedStatements' };
  if (args[0] !== 'run' || args.length !== 15) fail();
  const config = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = keys[args[i]];
    if (!key || Object.hasOwn(config, key) || typeof args[i + 1] !== 'string') fail();
    if (key === 'omittedStatements') { try { config[key] = JSON.parse(args[i + 1]); } catch { fail(); } }
    else config[key] = args[i + 1];
  }
  return config;
}
export async function main(args, emit = line => process.stdout.write(line + '\n'), factory = null) {
  let adapter;
  try {
    const config = parseArguments(args);
    const create = factory ?? (await import('./lib/prisma-restore-native.mjs')).createNativeAdapter;
    adapter = create(config);
  } catch {
    emit(JSON.stringify({ invocation: 0, runId: null, phase: args[0] === 'run' ? 'configuration' : 'explicit-run-required', passed: false, cleanup: 'not-created', native: { exit: null, timedOut: false }, ownedCleanup: [] }));
    return 1;
  }
  const receipt = await runRehearsal(adapter);
  emit(JSON.stringify({ invocation: 1, runId: adapter.runId, ...receipt, ...adapter.metadata() }));
  return receipt.passed ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
