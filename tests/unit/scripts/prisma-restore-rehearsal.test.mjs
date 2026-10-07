import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import * as nativeModule from '../../../scripts/lib/prisma-restore-native.mjs';
import { nativeCommand, validatePublicInputs, validateConfiguration, assertImage, createNativeAdapter, assertPendingOctoberSQL } from '../../../scripts/lib/prisma-restore-native.mjs';
import { assertLedger, assertCatalog, assertOctoberCatalog, INDEXES, FOREIGN_KEYS, CHECKS } from '../../../scripts/lib/prisma-restore-catalog.mjs';
import { filterPublicCopy, assertContext, assertEnvironment, reconcileClone, cleanupOwned, assertIsolation, createBudget, runRehearsal, main, cloneURL, assertBaseImage, filterSchema, verifyPinned, MIGRATION_PINS, commandEnvironment } from '../../../scripts/rehearse-prisma-restore.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const env = commandEnvironment({ PATH: '/bin', DATABASE_URL: 'never-forward' }, path.resolve('mock-config'), 'win32');
const options = { cwd: path.resolve('mock-work'), env, timeout: 100 };
const success = stdout => ({ status: 0, signal: null, stdout, stderr: '' });
const fseventsIntegrity = 'sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==';
function addOptionalFixture(packages) {
  packages['node_modules/prisma'].optionalDependencies = { fsevents: '2.3.3' };
  packages['node_modules/fsevents'] = { version: '2.3.3', optional: true, os: ['darwin'], resolved: 'https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz', integrity: fseventsIntegrity };
}
test('actual Prisma wrapper constructs command-specific argv without executing Prisma', () => {
  const source = readFileSync(new URL('../../../scripts/lib/prisma-restore-native.mjs', import.meta.url), 'utf8');
  const wrapper = /const PRISMA_WRAPPER = `([\s\S]*?)`;/ .exec(source)[1];
  for (const command of ['diff', 'resolve', 'deploy', 'status']) {
    let argv;
    const requested = command === 'diff' ? ['migrate', command, '--from-schema-datasource', '/work/prisma/schema.prisma', '--to-schema-datamodel', '/work/prisma/schema.prisma', '--exit-code'] : ['migrate', command];
    const input = JSON.stringify({ args: requested, url: 'fixture', timeout: 50 });
    vm.runInNewContext(wrapper, { require: name => name === 'node:fs' ? { readFileSync: () => input } : { spawnSync: (_exe, args) => { argv = args; return { status: 0, stdout: '' }; } }, process: { stdout: { write() {} }, exit: () => assert.fail('unexpected wrapper exit') } });
    assert.equal(argv.includes('--schema'), command !== 'diff');
    assert.deepEqual(Array.from(argv), ['/opt/r4/node_modules/prisma/build/index.js', ...requested, ...(command === 'diff' ? [] : ['--schema', '/work/prisma/schema.prisma'])]);
  }
});
test('log persistence is rejected before private input admission', () => {
  const expected = { name: 'db', run: '0123456789abcdef', id: 'a'.repeat(64), imageId: 'sha256:' + 'b'.repeat(64), imageReference: 'pinned', network: 'net', networkId: 'c'.repeat(64), tmpfs: ['/tmp'] };
  const resource = { Id: expected.id, Name: '/db', Image: expected.imageId, Config: { Image: 'pinned', Labels: { 'local.edi.r4.run': expected.run } }, HostConfig: { ReadonlyRootfs: true, NetworkMode: 'net', Tmpfs: { '/tmp': 'rw' }, LogConfig: { Type: 'none' } }, NetworkSettings: { Networks: { net: { NetworkID: expected.networkId } } }, Mounts: [] };
  assertIsolation(resource, expected);
  for (const type of ['json-file', 'local', 'syslog', 'fluentd', undefined]) {
    const mutated = { ...resource, HostConfig: { ...resource.HostConfig, LogConfig: type ? { Type: type } : undefined } };
    assert.throws(() => assertIsolation(mutated, expected));
  }
});

test('absence recognizes only exact no-such metadata and empty inspection output', () => {
  const result = { status: 1, signal: null, stdout: '[]\n', stderr: 'Error: No such container: fixture' };
  assert.equal(nativeModule.isInspectionAbsent(result, 'container', 'fixture'), true);
  assert.equal(nativeModule.isInspectionAbsent({ ...result, stdout: '' }, 'container', 'fixture'), true);
  for (const mutation of [{ stdout: '[{}]' }, { stdout: '[' }, { stdout: 'null' }, { stderr: 'daemon unavailable' }, { stderr: 'Error: No such container: foreign' }, { error: { code: 'ETIMEDOUT' } }, { signal: 'SIGKILL' }, { timedOut: true }, { status: 0 }]) assert.equal(nativeModule.isInspectionAbsent({ ...result, ...mutation }, 'container', 'fixture'), false);
});
test('native boundary rejects errors, timeouts, unsafe env and shell execution', () => {
  for (const result of [{ ...success('arbitrary success'), status: 1 }, { ...success(''), error: { code: 'ETIMEDOUT' } }, { ...success(''), signal: 'SIGKILL' }]) {
    assert.throws(() => nativeCommand(() => result, 'docker', ['version'], options));
  }
  assert.throws(() => nativeCommand(() => success(''), 'docker', [], { ...options, env: { ...env, DATABASE_URL: 'private' } }));
  assert.throws(() => nativeCommand(() => success(''), 'sh', [], options));
  nativeCommand((exe, args, opts) => { assert.equal(exe, 'docker'); assert.deepEqual(args, ['version']); assert.equal(opts.shell, false); assert.equal(opts.maxBuffer, 1048576); assert.equal(opts.env.DOCKER_HOST, 'npipe:////./pipe/docker_engine'); return success('ok'); }, 'docker', ['version'], options);
});
test('reviewed public lock inputs bind exact hashes, versions and package allowlist', () => {
  const pkg = Buffer.from(JSON.stringify({ private: true, dependencies: { prisma: '5.22.0' } }));
  const packages = { '': { dependencies: { prisma: '5.22.0' } } };
  for (const name of ['prisma', '@prisma/engines', '@prisma/engines-version', '@prisma/debug', '@prisma/fetch-engine', '@prisma/get-platform']) packages['node_modules/' + name] = { version: '5.22.0', resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-5.22.0.tgz`, integrity: 'sha512-' + Buffer.alloc(64).toString('base64') };
  addOptionalFixture(packages);
  const lock = Buffer.from(JSON.stringify({ lockfileVersion: 3, packages }));
  const config = { packageHash: hash(pkg), lockHash: hash(lock) };
  validatePublicInputs(pkg, lock, config);
  const rejects = mutate => {
    const copy = JSON.parse(lock); mutate(copy.packages);
    const bytes = Buffer.from(JSON.stringify(copy));
    assert.throws(() => validatePublicInputs(pkg, bytes, { ...config, lockHash: hash(bytes) }));
  };
  for (const mutation of [{ version: '2.3.2' }, { optional: false }, { os: ['linux'] }, { os: ['darwin', 'linux'] }, { os: undefined }, { resolved: 'file:private' }, { resolved: 'https://foreign.invalid/fsevents.tgz' }, { integrity: 'sha512-' + Buffer.alloc(64).toString('base64') }]) rejects(entries => Object.assign(entries['node_modules/fsevents'], mutation));
  rejects(entries => { entries['node_modules/prisma'].optionalDependencies = { fsevents: 'file:private' }; });
  rejects(entries => { entries['node_modules/prisma'].optionalDependencies = { fsevents: '2.3.3', foreign: '1.0.0' }; });
  rejects(entries => { entries['node_modules/@prisma/debug'].optionalDependencies = { fsevents: '2.3.3' }; });
  rejects(entries => { entries[''].optionalDependencies = { foreign: '1.0.0' }; });
  assert.throws(() => validatePublicInputs(pkg, lock, { ...config, lockHash: 'a'.repeat(64) }));
  packages['node_modules/prisma'].resolved = 'file:private';
  const unsafe = Buffer.from(JSON.stringify({ lockfileVersion: 3, packages }));
  assert.throws(() => validatePublicInputs(pkg, unsafe, { ...config, lockHash: hash(unsafe) }));
  assert.throws(() => validateConfiguration({}));
  assert.throws(() => createNativeAdapter({}, { execute: () => assert.fail('must not execute') }));
});
test('exact schema omissions and dump fingerprints do not weaken on changes', () => {
  const omitted = ['CREATE EXTENSION IF NOT EXISTS a;', 'CREATE EXTENSION IF NOT EXISTS b;', 'CREATE EXTENSION IF NOT EXISTS c;', 'CREATE EXTENSION IF NOT EXISTS d;', 'ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";'];
  const ddl = omitted.join('\n') + '\nCREATE EXTENSION IF NOT EXISTS unexpected;\n';
  assert.match(filterSchema(ddl, omitted), /unexpected/);
  assert.throws(() => filterSchema(ddl + omitted[0], omitted));
  assert.throws(() => filterSchema(ddl.replace(omitted[0], ''), omitted));
  const fixture = Buffer.from('in-memory fixture');
  verifyPinned(fixture, fixture.length, hash(fixture));
  assert.throws(() => verifyPinned(fixture, fixture.length + 1, hash(fixture)));
  assert.throws(() => verifyPinned(fixture, fixture.length, 'a'.repeat(64)));
});
test('pending October SQL accepts formatting only and refuses empty or additional drift', () => {
  const pinned = readFileSync(new URL('../../../prisma/migrations/20261007161500_link_worker_day_mileage/migration.sql', import.meta.url), 'utf8');
  const formatted = pinned.replace(/^--[^\n]*\n/gm, '').replace(/\s+/g, ' ').trim();
  assertPendingOctoberSQL(formatted, pinned);
  for (const sql of ['', '-- no difference\n', formatted + '\nALTER TABLE "TruckMileage" DROP COLUMN "id";', formatted.replace('ON DELETE CASCADE', 'ON DELETE RESTRICT'), formatted + ' @']) assert.throws(() => assertPendingOctoberSQL(sql, pinned));
});
test('October pin and seven-row ledger reject missing or drifted migration', () => {
  const names = Object.keys(MIGRATION_PINS);
  assert.equal(names.length, 7);
  assert.equal(names.at(-1), '20261007161500_link_worker_day_mileage');
  assert.equal(MIGRATION_PINS[names.at(-1)], 'afe7183ba12ba7e030e68a56ddf2bfdfa0e254c8dc4995b06935af1ad7131794');
  const rows = names.map((name, i) => `${name}|${MIGRATION_PINS[name]}|true|true|${i === 3 || i === 4 ? 0 : 1}`);
  assertLedger(rows.join('\n'), MIGRATION_PINS, true);
  assert.throws(() => assertLedger(rows.slice(0, -1).join('\n'), MIGRATION_PINS, true));
  assert.throws(() => assertLedger(rows.join('\n').replace('|true|true|1', '|true|true|0'), MIGRATION_PINS, true));
});
test('October catalog requires nullable source, unique index definition and validated cascade FK', () => {
  const actual = { columns: [{ column_name: 'sourceWorkerDaySegmentId', data_type: 'text', is_nullable: 'YES' }], indexes: [{ indexname: 'TruckMileage_sourceWorkerDaySegmentId_key', indexdef: 'CREATE UNIQUE INDEX "TruckMileage_sourceWorkerDaySegmentId_key" ON public."TruckMileage" USING btree ("sourceWorkerDaySegmentId")' }], constraints: [{ name: 'TruckMileage_sourceWorkerDaySegmentId_fkey', type: 'f', validated: true, definition: 'FOREIGN KEY ("sourceWorkerDaySegmentId") REFERENCES "WorkerDayTruckSegment"(id) ON UPDATE CASCADE ON DELETE CASCADE' }] };
  assertOctoberCatalog(actual);
  for (const bad of [{ ...actual, columns: [{ ...actual.columns[0], is_nullable: 'NO' }] }, { ...actual, indexes: [{ ...actual.indexes[0], indexdef: actual.indexes[0].indexdef.replace('UNIQUE ', '') }] }, { ...actual, constraints: [{ ...actual.constraints[0], validated: false }] }, { ...actual, constraints: [{ ...actual.constraints[0], definition: actual.constraints[0].definition.replace('ON DELETE CASCADE', 'ON DELETE NO ACTION') }] }]) assert.throws(() => assertOctoberCatalog(bad));
});
test('ledger rows require exact checksums, completion and step counts', () => {
  const names = Object.keys(MIGRATION_PINS);
  const text = names.map((name, i) => `${name}|${MIGRATION_PINS[name]}|true|true|${i === 3 || i === 4 ? 0 : 1}`).join('\n');
  assertLedger(text, MIGRATION_PINS, true);
  assertLedger(text.split('\n').slice(0, 3).join('\n'), MIGRATION_PINS);
  for (const mutation of [text.replace('|true|', '|false|'), text + '\n' + text.split('\n')[0], text.replace('|0', '|1')]) assert.throws(() => assertLedger(mutation, MIGRATION_PINS, true));
});
test('effective image digest, platform and ownership are mandatory', () => {
  const digest = 'sha256:' + 'a'.repeat(64);
  const image = { Id: 'sha256:' + 'b'.repeat(64), Os: 'linux', Architecture: 'amd64', RepoDigests: ['postgres@' + digest] };
  assertImage(image, 'postgres:17.6-bookworm@' + digest);
  assert.throws(() => assertImage({ ...image, Architecture: 'arm64' }, 'postgres:17.6-bookworm@' + digest));
  assert.throws(() => assertImage({ ...image, RepoDigests: ['foreign@' + digest] }, 'postgres:17.6-bookworm@' + digest));
});
test('catalog checks reject missing effects and definition drift', () => {
  const reference = { valid: true, noPayment: true, checks: CHECKS, indexes: INDEXES.map(indexname => ({ indexname })), constraints: [...FOREIGN_KEYS.map(name => ({ name, type: 'f' })), ...CHECKS.map(name => ({ name, type: 'c', validated: true, definition: 'fixture' }))] };
  assertCatalog(reference, reference);
  assert.throws(() => assertCatalog({ ...reference, checks: CHECKS.slice(1) }, reference));
  assert.throws(() => assertCatalog({ ...reference, valid: false }, reference));
});
test('successful mocked CLI epoch executes all bounded gates and cleanup', async () => {
  const calls = [], receipts = [];
  const methods = ['buildPublicSidecar', 'provision', 'proveIsolationAndFilesystems', 'connectionPreflight', 'verifyPrivatePins', 'restorePublicOnlyAndValidateCircularFKs', 'ledgerBefore', 'correctiveSQL', 'proveAllEffects', 'diffOctoberPending', 'diff', 'resolve', 'deploy', 'catalog', 'ledgerAfter', 'status'];
  const adapter = Object.fromEntries(methods.map(name => [name, async () => { calls.push(name); nativeCommand(() => success('mock'), 'docker', ['mock-' + name], options); }]));
  adapter.runId = '0123456789abcdef'; adapter.metadata = () => ({ native: { exit: 0, timedOut: false }, ownedCleanup: [] });
  adapter.cleanup = async () => { calls.push('cleanup'); return 'complete'; };
  const args = ['run', '--repository', 'repo', '--artifacts', 'dump', '--public-inputs', 'public', '--node-image', 'image', '--package-sha256', 'hash', '--lock-sha256', 'hash', '--omit-sql-json', '[]'];
  assert.equal(await main(args, line => receipts.push(JSON.parse(line)), () => adapter), 0);
  assert.equal(receipts[0].passed, true);
  assert.ok(calls.indexOf('buildPublicSidecar') < calls.indexOf('verifyPrivatePins'));
  assert.ok(calls.indexOf('proveAllEffects') < calls.indexOf('diffOctoberPending'));
  assert.ok(calls.indexOf('diffOctoberPending') < calls.indexOf('resolve'));
  assert.equal(calls.filter(n => n === 'resolve').length, 2);
  assert.equal(calls.filter(n => n === 'diff').length, 1);
  assert.ok(calls.indexOf('deploy') < calls.indexOf('diff'));
  assert.equal(calls.at(-1), 'cleanup');
});

test('native adapter completes a synthetic epoch with owned command cleanup', async () => {
  const root = path.resolve('fixture-root'), repo = path.join(root, 'repo'), pub = path.join(root, 'public'), dumps = path.join(root, 'dumps');
  const files = new Map(), directories = new Set();
  const put = (name, value) => { files.set(name, Buffer.from(value)); for (let dir = path.dirname(name); ; dir = path.dirname(dir)) { directories.add(dir); if (dir === path.dirname(dir)) break; } };
  const pkg = JSON.stringify({ private: true, dependencies: { prisma: '5.22.0' } });
  const packages = { '': { dependencies: { prisma: '5.22.0' } } };
  for (const name of ['prisma', '@prisma/engines', '@prisma/engines-version', '@prisma/debug', '@prisma/fetch-engine', '@prisma/get-platform']) packages['node_modules/' + name] = { version: '5.22.0', resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-5.22.0.tgz`, integrity: 'sha512-' + Buffer.alloc(64).toString('base64') };
  addOptionalFixture(packages);
  const lock = JSON.stringify({ lockfileVersion: 3, packages });
  put(path.join(pub, 'package.json'), pkg); put(path.join(pub, 'package-lock.json'), lock);
  put(path.join(repo, 'docker/local-r4/Dockerfile'), 'public Dockerfile fixture');
  put(path.join(repo, 'prisma/schema.prisma'), 'public schema fixture');
  put(path.join(repo, 'prisma/migrations/migration_lock.toml'), 'provider = "postgresql"');
  // Only public historical migration source is read; dump fixtures stay synthetic.
  for (const name of Object.keys(MIGRATION_PINS)) put(path.join(repo, 'prisma/migrations', name, 'migration.sql'), readFileSync(new URL('../../../prisma/migrations/' + name + '/migration.sql', import.meta.url)));
  const omissions = ['CREATE EXTENSION IF NOT EXISTS a;', 'CREATE EXTENSION IF NOT EXISTS b;', 'CREATE EXTENSION IF NOT EXISTS c;', 'CREATE EXTENSION IF NOT EXISTS d;', 'ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";'];
  put(path.join(dumps, 'schema.sql'), omissions.join('\n') + '\nCREATE TABLE IF NOT EXISTS "public"."_prisma_migrations" (id text);\n');
  put(path.join(dumps, 'data.sql'), 'COPY "public"."_prisma_migrations" (id) FROM stdin;\nfixture\n\\.\n');
  const stat = name => { if (!files.has(name) && !directories.has(name)) throw new Error('missing fixture'); return { isSymbolicLink: () => false, isFile: () => files.has(name), size: files.get(name)?.length ?? 0, dev: 1, ino: 1, mtimeMs: 0, ctimeMs: 0 }; };
  let privateReads = 0;
  const filesystem = { constants: { O_RDONLY: 0 }, lstatSync: stat, realpathSync: name => name, openSync: name => name, fstatSync: stat, readFileSync: name => { if (path.dirname(name) === dumps) privateReads++; return files.get(name); }, closeSync() {},
    readdirSync: dir => [...new Set([...files.keys(), ...directories].filter(name => path.dirname(name) === dir).map(name => path.basename(name)))],
    mkdtempSync: prefix => { const name = prefix + 'mock'; directories.add(name); return name; }, mkdirSync: name => directories.add(name), writeFileSync: put, rmSync() {},
  };
  const run = '0123456789abcdef', imageId = 'sha256:' + 'b'.repeat(64), pgId = 'sha256:' + 'c'.repeat(64), networkId = 'd'.repeat(64);
  const imageName = `edi-r4-client-${run}:local`, netName = `edi-r4-net-${run}`;
  let built = false, netCreated = false, nextId = 1, privateVerifications = 0;
  const containers = new Map(), calls = [];
  const catalog = { valid: true, noPayment: true, checks: CHECKS, indexes: INDEXES.map(indexname => ({ indexname })), constraints: [...FOREIGN_KEYS.map(name => ({ name, type: 'f' })), ...CHECKS.map(name => ({ name, type: 'c', validated: true }))] };
  const execute = (exe, args, opts) => {
    assert.equal(exe, 'docker'); assert.equal(opts.shell, false); assert.ok(opts.timeout > 0); calls.push(args);
    const [action, second] = args;
    if (action === 'version') return success(JSON.stringify({ Os: 'linux' }));
    if (action === 'build') { built = true; put(args[args.indexOf('--iidfile') + 1], imageId + '\n'); return success(''); }
    if (action === 'pull') return success('');
    if (second === 'inspect') {
      const target = args[2]; let resource = null;
      if (action === 'image') {
        if (target.startsWith('postgres:')) resource = { Id: pgId, Os: 'linux', Architecture: 'amd64', RepoDigests: ['postgres@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3'] };
        else if (target.startsWith('node:')) resource = { Id: 'sha256:' + 'f'.repeat(64), Os: 'linux', Architecture: 'amd64', RepoDigests: ['node@sha256:' + 'a'.repeat(64)] };
        else if (built) resource = { Id: imageId, Os: 'linux', Architecture: 'amd64', RepoTags: [imageName], Config: { Labels: { 'local.edi.r4.run': run } } };
      }
      if (action === 'container') resource = [...containers.values()].find(c => c.Id === target || c.Name === '/' + target);
      if (action === 'network' && netCreated) resource = { Id: networkId, Name: netName, Internal: true, Driver: 'bridge', Labels: { 'local.edi.r4.run': run }, Containers: Object.fromEntries([...containers.values()].map(c => [c.Id, {}])) };
      return resource ? success(JSON.stringify([resource])) : { status: 1, signal: null, stdout: '[]\n', stderr: `Error: No such ${action}: ${target}` };
    }
    if (action === 'network' && second === 'create') { netCreated = true; return success(networkId); }
    if (action === 'create') {
      assert.ok(args.includes('--log-driver=none'));
      const name = args[args.indexOf('--name') + 1], pg = name.includes('-db-'), id = String(nextId++).repeat(64);
      const mounts = args.filter((_, i) => args[i - 1] === '--tmpfs').map(v => v.split(':')[0]);
      containers.set(name, { Id: id, Name: '/' + name, Image: pg ? pgId : imageId, Config: { Image: pg ? args.at(-1) : imageName, Labels: { 'local.edi.r4.run': run } }, HostConfig: { LogConfig: { Type: 'none' }, ReadonlyRootfs: true, NetworkMode: netName, Tmpfs: Object.fromEntries(mounts.map(v => [v, 'rw'])) }, NetworkSettings: { Networks: { [netName]: { NetworkID: networkId } }, Ports: {} }, Mounts: [] });
      return success(id);
    }
    if (action === 'exec') {
      if (args.includes('stat')) return success('tmpfs\n');
      if (args.includes('node')) {
        if (opts.input?.includes('"args"')) { const input = JSON.parse(opts.input); const preflight = input.args.includes('--script'); const pending = preflight && privateVerifications > 0; return success(JSON.stringify({ exit: preflight ? 2 : 0, output: pending ? readFileSync(new URL('../../../prisma/migrations/20261007161500_link_worker_day_mileage/migration.sql', import.meta.url), 'utf8') : preflight ? 'DailyPayDay WorkerDayOperation WorkerDayTruckSegment' : input.args.includes('diff') ? 'No difference detected.' : '' })); }
        return success('');
      }
      if (opts.input.includes('server_version_num')) return success(`17.6|170006|edi_r4_${run}|postgres\n`);
      if (opts.input.includes('migration_name ||')) {
        const names = Object.keys(MIGRATION_PINS).slice(0, privateVerifications++ === 1 ? 7 : 3);
        return success(names.map((name, i) => `${name}|${MIGRATION_PINS[name]}|true|true|${i === 3 || i === 4 ? 0 : 1}`).join('\n'));
      }
      if (opts.input.includes('sourceWorkerDaySegmentId')) return success(JSON.stringify({ columns: [{ column_name: 'sourceWorkerDaySegmentId', data_type: 'text', is_nullable: 'YES' }], indexes: [{ indexname: 'TruckMileage_sourceWorkerDaySegmentId_key', indexdef: 'CREATE UNIQUE INDEX "TruckMileage_sourceWorkerDaySegmentId_key" ON public."TruckMileage" USING btree ("sourceWorkerDaySegmentId")' }], constraints: [{ name: 'TruckMileage_sourceWorkerDaySegmentId_fkey', type: 'f', validated: true, definition: 'FOREIGN KEY ("sourceWorkerDaySegmentId") REFERENCES "WorkerDayTruckSegment"(id) ON UPDATE CASCADE ON DELETE CASCADE' }] }));
      if (opts.input.includes('json_build_object')) return success(JSON.stringify(catalog));
      return success('');
    }
    if (action === 'container' && second === 'rm') { for (const [name, c] of containers) if (c.Id === args.at(-1)) containers.delete(name); }
    if (action === 'network' && second === 'rm') netCreated = false;
    if (action === 'image' && second === 'rm') built = false;
    return success('');
  };
  const config = { repository: repo, artifacts: dumps, publicInputs: pub, nodeImage: 'node:22.22.2-bookworm-slim@sha256:' + 'a'.repeat(64), packageHash: hash(pkg), lockHash: hash(lock), omittedStatements: omissions };
  const adapter = createNativeAdapter(config, { fs: filesystem, execute, tmpdir: root, runId: run, password: 'e'.repeat(64), ambient: {}, verifyPinned: bytes => { assert.ok(Buffer.isBuffer(bytes)); } });
  const receipt = await runRehearsal(adapter);
  assert.deepEqual(receipt, { phase: 'complete', passed: true, cleanup: 'complete' });
  assert.equal(containers.size, 0); assert.equal(netCreated, false); assert.equal(built, false);
  assert.equal(calls.filter(a => a[0] === 'build').length, 1);
  assert.equal(adapter.metadata().ownedCleanup.filter(c => c.operation === 'remove' && c.exit === 0).length, 4);
  calls.length = 0;
  const partial = createNativeAdapter(config, { fs: filesystem, tmpdir: root, runId: run, password: 'e'.repeat(64), ambient: {}, execute: (exe, args, opts) => {
    const result = execute(exe, args, opts);
    return args[0] === 'create' ? { ...result, status: 1 } : result;
  } });
  assert.deepEqual(await runRehearsal(partial), { phase: 'provision', passed: false, cleanup: 'complete' });
  assert.equal(calls.filter(a => a[0] === 'create').length, 1);
  assert.equal(containers.size, 0);
  assert.equal(partial.metadata().native.exit, 1);
  calls.length = 0;
  const ambiguous = createNativeAdapter(config, { fs: filesystem, tmpdir: root, runId: run, password: 'e'.repeat(64), ambient: {}, execute: (exe, args, opts) => {
    if (args[0] === 'network' && args[1] === 'inspect') return { status: 1, signal: null, stdout: '', stderr: 'daemon unavailable' };
    return execute(exe, args, opts);
  } });
  assert.deepEqual(await runRehearsal(ambiguous), { phase: 'provision', passed: false, cleanup: 'complete' });
  assert.equal(calls.filter(a => a[0] === 'create').length, 0);
  const wrongFilesystem = createNativeAdapter(config, { fs: filesystem, tmpdir: root, runId: run, password: 'e'.repeat(64), ambient: {}, execute: (exe, args, opts) => args.includes('stat') ? success('ext4\n') : execute(exe, args, opts) });
  assert.deepEqual(await runRehearsal(wrongFilesystem), { phase: 'isolation', passed: false, cleanup: 'complete' });
  privateReads = 0;
  const logged = createNativeAdapter(config, { fs: filesystem, tmpdir: root, runId: run, password: 'e'.repeat(64), ambient: {}, execute: (exe, args, opts) => {
    const result = execute(exe, args, opts);
    if (args[0] === 'container' && args[1] === 'inspect' && result.status === 0) {
      const inspected = JSON.parse(result.stdout); inspected[0].HostConfig.LogConfig = { Type: 'json-file' };
      return success(JSON.stringify(inspected));
    }
    return result;
  } });
  assert.deepEqual(await runRehearsal(logged), { phase: 'isolation', passed: false, cleanup: 'complete' });
  assert.equal(privateReads, 0);
});

test('public COPY filtering respects row boundaries, not SQL-looking row text', () => {
  const source = 'COPY "auth"."users" (id) FROM stdin;\nprivate\n\\.\nCOPY "public"."_prisma_migrations" (id) FROM stdin;\nCOPY "auth"."users" (id) FROM stdin;\n\\.\n';
  assert.equal(filterPublicCopy(source, ['_prisma_migrations']), 'COPY "public"."_prisma_migrations" (id) FROM stdin;\nCOPY "auth"."users" (id) FROM stdin;\n\\.\n');
  assert.throws(() => filterPublicCopy(source.slice(0, -3), ['_prisma_migrations']));
  assert.throws(() => filterPublicCopy(source + source, ['_prisma_migrations']));
});
test('local targeting and base digest fail closed', async () => {
  assert.throws(() => assertBaseImage('node:22-bookworm-slim'));
  assertBaseImage('node:22.22.2-bookworm-slim@sha256:' + 'a'.repeat(64));
  assert.match(cloneURL('0123456789abcdef', 'b'.repeat(64)), /@edi-r4-db-0123456789abcdef:5432\//);
  assert.throws(() => cloneURL('localhost', 'b'.repeat(64)));
  const receipts = [];
  assert.equal(await main(['run'], line => receipts.push(JSON.parse(line))), 1);
  assert.equal(receipts[0].phase, 'configuration');
});
test('independent cleanup budget starts even after work expiry', () => {
  let now = 0;
  const budget = createBudget(() => now, 100, 50);
  now = 101;
  assert.throws(() => budget.cap(10));
  budget.beginCleanup();
  assert.equal(budget.cap(100), 50);
  now = 152;
  budget.beginCleanup();
  assert.throws(() => budget.cap(10));
});
test('published ports and persistent mounts are rejected', () => {
  const expected = { name: 'db', run: '0123456789abcdef', id: 'a'.repeat(64), imageId: 'sha256:' + 'b'.repeat(64), imageReference: 'pinned', network: 'net', networkId: 'c'.repeat(64), tmpfs: ['/tmp'] };
  const container = { Id: expected.id, Name: '/db', Image: expected.imageId, Config: { Image: 'pinned', Labels: { 'local.edi.r4.run': expected.run } }, HostConfig: { LogConfig: { Type: 'none' }, ReadonlyRootfs: true, NetworkMode: 'net', Tmpfs: { '/tmp': 'rw' } }, NetworkSettings: { Networks: { net: { NetworkID: expected.networkId } }, Ports: { '5432/tcp': null } }, Mounts: [] };
  assertIsolation(container, expected);
  for (const mutation of [{ ...container, Name: '/foreign' }, { ...container, Image: 'sha256:' + 'f'.repeat(64) }, { ...container, HostConfig: { ...container.HostConfig, ReadonlyRootfs: false } }, { ...container, NetworkSettings: { Networks: { external: {} } } }]) assert.throws(() => assertIsolation(mutation, expected));
  container.HostConfig.PortBindings = { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '5432' }] };
  assert.throws(() => assertIsolation(container, expected));
  delete container.HostConfig.PortBindings;
  container.Mounts = [{ Type: 'volume', Destination: '/data' }];
  assert.throws(() => assertIsolation(container, expected));
});
test('private reads never precede public build and failures never retry', async () => {
  const calls = [];
  const io = { buildPublicSidecar: async () => { calls.push('build'); throw new Error('secret fixture'); }, cleanup: async () => { calls.push('cleanup'); return 'complete'; }, verifyPrivatePins: async () => calls.push('private') };
  assert.deepEqual(await runRehearsal(io), { phase: 'public-build', passed: false, cleanup: 'complete' });
  assert.deepEqual(calls, ['build', 'cleanup']);
});
test('context and environment reject unsafe inputs', () => {
  assertContext(['package.json', 'package-lock.json', 'Dockerfile']);
  for (const file of ['.env', '../package.json', 'data.sql', 'src/app.ts']) assert.throws(() => assertContext(['package.json', 'package-lock.json', 'Dockerfile', file]));
  assert.throws(() => assertEnvironment({ PATH: '/bin', DATABASE_URL: 'private' }));
});
test('all effects precede resolve; any failure stops without retries', async () => {
  const calls = [];
  const io = Object.fromEntries(['ledgerBefore', 'correctiveSQL', 'proveAllEffects', 'diffOctoberPending', 'diff', 'resolve', 'deploy', 'catalog', 'ledgerAfter', 'status'].map(name => [name, async (...args) => calls.push([name, ...args])]));
  await reconcileClone(io);
  assert.deepEqual(calls.map(c => c[0]), ['ledgerBefore', 'correctiveSQL', 'proveAllEffects', 'diffOctoberPending', 'resolve', 'resolve', 'deploy', 'diff', 'catalog', 'ledgerAfter', 'status']);
  calls.length = 0;
  io.diffOctoberPending = async () => { calls.push(['diffOctoberPending']); throw new Error('unexpected drift'); };
  await assert.rejects(reconcileClone(io));
  assert.deepEqual(calls.map(c => c[0]), ['ledgerBefore', 'correctiveSQL', 'proveAllEffects', 'diffOctoberPending']);
  io.diffOctoberPending = async () => calls.push(['diffOctoberPending']);
  calls.length = 0;
  io.proveAllEffects = async () => { calls.push(['proveAllEffects']); throw new Error('fixture'); };
  await assert.rejects(reconcileClone(io));
  assert.deepEqual(calls.map(c => c[0]), ['ledgerBefore', 'correctiveSQL', 'proveAllEffects']);
  calls.length = 0;
  io.ledgerBefore = async () => { calls.push(['ledgerBefore']); throw new Error('ledger drift'); };
  await assert.rejects(reconcileClone(io));
  assert.deepEqual(calls.map(c => c[0]), ['ledgerBefore']);
});
test('cleanup refuses identity drift and recovers only exact attempted names', async () => {
  const owned = { Id: 'a'.repeat(64), Name: '/edi-r4-db-0123456789abcdef', Config: { Labels: { 'local.edi.r4.run': '0123456789abcdef' } } };
  let inspections = 0;
  const removed = [];
  const io = { inspect: async () => { inspections++; return inspections === 1 ? owned : { ...owned, Config: { Labels: {} } }; }, remove: async id => removed.push(id) };
  assert.equal(await cleanupOwned(io, [{ kind: 'container', name: owned.Name.slice(1), attempted: true }], '0123456789abcdef'), 'unknown-stop');
  assert.deepEqual(removed, []);
  inspections = 0;
  io.inspect = async () => owned;
  assert.equal(await cleanupOwned(io, [{ kind: 'container', name: owned.Name.slice(1), attempted: true }], '0123456789abcdef'), 'complete');
  assert.deepEqual(removed, [owned.Id]);
  io.inspect = async () => { throw new Error('ambiguous timeout'); };
  assert.equal(await cleanupOwned(io, [{ kind: 'container', name: owned.Name.slice(1), attempted: true }], '0123456789abcdef'), 'unknown-stop');
});
