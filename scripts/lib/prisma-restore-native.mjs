import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import {
  POSTGRES_IMAGE, OWNER, DUMP_PINS, MIGRATION_PINS, verifyPinned, assertContext,
  assertBaseImage, assertEnvironment, commandEnvironment, cloneURL, filterSchema, filterPublicCopy,
  assertIsolation, assertNetwork, createBudget, cleanupOwned,
} from '../rehearse-prisma-restore.mjs';
import { REFERENCE_BASE, VALIDATE_SQL, LEDGER_SQL, CATALOG_SQL, OCTOBER_CATALOG_SQL, assertCatalog, assertOctoberCatalog, assertLedger } from './prisma-restore-catalog.mjs';

const refuse = () => { throw new Error('native-contract-refused'); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const idPattern = /^[a-f0-9]{64}$/;
const imagePattern = /^sha256:[a-f0-9]{64}$/;
const maxBuffer = 1024 * 1024;
const octoberMigration = 'prisma/migrations/20261007161500_link_worker_day_mileage/migration.sql';
// Tokenize the entire SQL: comments and whitespace may vary, but no SQL token may.
// Quoted identifiers and string literals retain their exact bytes.
export function assertPendingOctoberSQL(actual, pinned) {
  const tokens = text => {
    if (typeof text !== 'string') refuse();
    const result = [];
    const pattern = /\s+|--[^\r\n]*|\/\*[\s\S]*?\*\/|"(?:[^"]|"")*"|'(?:[^']|'')*'|[A-Za-z_][A-Za-z_0-9]*|[0-9]+|[(),.;=]/y;
    for (let at = 0; at < text.length;) {
      pattern.lastIndex = at;
      const match = pattern.exec(text);
      if (!match) refuse();
      const token = match[0];
      if (!/^\s|^--|^\/\*/.test(token)) result.push(/^[A-Za-z_]/.test(token) ? token.toUpperCase() : token);
      at = pattern.lastIndex;
    }
    return result;
  };
  const expected = tokens(pinned), observed = tokens(actual);
  if (!expected.length || observed.length !== expected.length || observed.some((token, i) => token !== expected[i])) refuse();
}
function parseJSON(text) { try { return JSON.parse(text); } catch { refuse(); } }
export function validateConfiguration(config) {
  assertBaseImage(config.nodeImage);
  for (const field of ['repository', 'artifacts', 'publicInputs']) if (typeof config[field] !== 'string' || !path.isAbsolute(config[field])) refuse();
  for (const field of ['packageHash', 'lockHash']) if (!/^[a-f0-9]{64}$/.test(config[field] ?? '')) refuse();
  // An exact, reviewed platform statement list is a required operator input.
  filterSchema(config.omittedStatements?.join('\n') ?? '', config.omittedStatements);
}
export function validatePublicInputs(pkgBytes, lockBytes, config) {
  if (sha(pkgBytes) !== config.packageHash || sha(lockBytes) !== config.lockHash) refuse();
  const pkg = parseJSON(pkgBytes), lock = parseJSON(lockBytes);
  if (Object.keys(pkg).some(k => !['name', 'version', 'private', 'dependencies'].includes(k)) ||
      JSON.stringify(pkg.dependencies) !== JSON.stringify({ prisma: '5.22.0' }) || lock.lockfileVersion !== 3 ||
      JSON.stringify(lock.packages?.['']?.dependencies) !== JSON.stringify(pkg.dependencies) ||
      Object.keys(lock.packages?.['']?.optionalDependencies ?? {}).length) refuse();
  const allowed = new Set(['prisma', '@prisma/engines', '@prisma/engines-version', '@prisma/debug', '@prisma/fetch-engine', '@prisma/get-platform', 'fsevents']);
  const fseventsIntegrity = 'sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==';
  const seen = new Set();
  for (const [name, entry] of Object.entries(lock.packages ?? {})) {
    if (!name) continue;
    if (!name.startsWith('node_modules/')) refuse();
    const packageName = name.slice(13);
    if (!allowed.has(packageName) || seen.has(packageName) || entry.link ||
        !/^https:\/\/registry\.npmjs\.org\//.test(entry.resolved ?? '') ||
        !/^sha512-[A-Za-z0-9+/]+=*$/.test(entry.integrity ?? '')) refuse();
    if ((packageName === 'prisma' || packageName === '@prisma/engines') && entry.version !== '5.22.0') refuse();
    if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/.test(entry.version ?? '')) refuse();
    const tarball = `https://registry.npmjs.org/${packageName}/-/${packageName.split('/').at(-1)}-${entry.version}.tgz`;
    if (entry.resolved !== tarball) refuse();
    for (const [dependency, version] of Object.entries(entry.dependencies ?? {})) {
      if (!allowed.has(dependency) || dependency === 'fsevents' || typeof version !== 'string' || /(?:https?:|git|file:|workspace:|link:)/.test(version)) refuse();
    }
    const optional = entry.optionalDependencies ?? {};
    if (typeof optional !== 'object' || optional === null || Array.isArray(optional)) refuse();
    if (packageName === 'prisma') {
      if (JSON.stringify(optional) !== JSON.stringify({ fsevents: '2.3.3' })) refuse();
    } else if (Object.keys(optional).length) refuse();
    if (packageName === 'fsevents' && (entry.version !== '2.3.3' || entry.optional !== true ||
        JSON.stringify(entry.os) !== JSON.stringify(['darwin']) || entry.integrity !== fseventsIntegrity || Object.keys(entry.dependencies ?? {}).length)) refuse();
    seen.add(packageName);
  }
  if (seen.size !== allowed.size) refuse();
}
export function readRegular(file, io = fs, limit = maxBuffer) {
  const absolute = path.resolve(file);
  // Bind every ancestor, including junctions, before opening any public/private file.
  for (let current = absolute; ; current = path.dirname(current)) {
    const stat = io.lstatSync(current);
    if (stat.isSymbolicLink() || path.resolve(io.realpathSync(current)) !== current) refuse();
    if (path.dirname(current) === current) break;
  }
  const before = io.lstatSync(absolute);
  if (!before.isFile() || before.size > limit) refuse();
  const fd = io.openSync(absolute, io.constants.O_RDONLY | (io.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = io.fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) refuse();
    const bytes = io.readFileSync(fd), after = io.fstatSync(fd);
    if (bytes.length !== before.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) refuse();
    return bytes;
  } finally { io.closeSync(fd); }
}
export function nativeCommand(execute, executable, args, options) {
  if (!['docker'].includes(executable) || !Array.isArray(args) || args.some(a => typeof a !== 'string' || /\0/.test(a)) ||
      !path.isAbsolute(options.cwd) || !Number.isFinite(options.timeout) || options.timeout <= 0) refuse();
  const { DOCKER_BUILDKIT, POSTGRES_PASSWORD, ...baseEnv } = options.env ?? {};
  assertEnvironment(baseEnv);
  if (DOCKER_BUILDKIT !== undefined && DOCKER_BUILDKIT !== '0' || POSTGRES_PASSWORD !== undefined && !/^[a-f0-9]{64}$/.test(POSTGRES_PASSWORD)) refuse();
  const result = execute(executable, args, { ...options, shell: false, encoding: 'utf8', windowsHide: true, killSignal: 'SIGKILL', maxBuffer });
  const timedOut = result?.error?.code === 'ETIMEDOUT';
  const meta = { exit: Number.isInteger(result?.status) && result.status >= 0 && result.status <= 255 ? result.status : null, timedOut };
  if (result?.error || result?.signal || meta.exit !== 0) {
    const error = new Error('native-command-failed'); error.native = meta; throw error;
  }
  if (typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout) > maxBuffer) refuse();
  return result.stdout;
}
function parseObject(text) {
  const parsed = parseJSON(text);
  if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0] || typeof parsed[0] !== 'object') refuse();
  return parsed[0];
}
export function isInspectionAbsent(result, kind, name) {
  if (!['container', 'network', 'image'].includes(kind) || result?.status !== 1 || result.error || result.signal || result.timedOut === true || typeof result.stdout !== 'string') return false;
  const matchingErrors = [`Error: No such ${kind}: ${name}`, `Error response from daemon: No such ${kind}: ${name}`, `Error: No such object: ${name}`];
  if (!matchingErrors.includes(result.stderr?.trim())) return false;
  if (result.stdout === '') return true;
  try { const parsed = JSON.parse(result.stdout); return Array.isArray(parsed) && parsed.length === 0; }
  catch { return false; }
}
export function assertImage(image, reference, run = null) {
  if (!imagePattern.test(image?.Id ?? '') || image.Os !== 'linux' || image.Architecture !== 'amd64') refuse();
  if (run !== null) {
    if (image.Config?.Labels?.[OWNER] !== run || image.Config?.Volumes && Object.keys(image.Config.Volumes).length ||
        !image.RepoTags?.includes(reference)) refuse();
  } else {
    const repository = reference.split(':')[0], expected = `${repository}@${reference.split('@')[1]}`;
    const normalized = (image.RepoDigests ?? []).map(v => v.replace(/^(?:docker\.io|index\.docker\.io)\/library\//, ''));
    if (!normalized.includes(expected)) refuse();
  }
  return image.Id;
}
// Fixed wrapper reads credentials on stdin, not Docker argv, and emits only the
// expected Prisma output to the captured/capped native boundary. No .env exists.
const PRISMA_WRAPPER = `const fs=require('node:fs'),cp=require('node:child_process');
const c=JSON.parse(fs.readFileSync(0,'utf8'));
const schemaArgs=c.args[0]==='migrate'&&['resolve','deploy','status'].includes(c.args[1])?['--schema','/work/prisma/schema.prisma']:[];
const r=cp.spawnSync('/usr/local/bin/node',['/opt/r4/node_modules/prisma/build/index.js',...c.args,...schemaArgs],{cwd:'/work',env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',DATABASE_URL:c.url,DIRECT_URL:c.url,CHECKPOINT_DISABLE:'1',PRISMA_HIDE_UPDATE_MESSAGE:'1'},encoding:'utf8',timeout:c.timeout,maxBuffer:1048576,killSignal:'SIGKILL'});
if(r.error||r.signal)process.exit(124);process.stdout.write(JSON.stringify({exit:r.status,output:r.stdout}));`;
const WRITE_WRAPPER = `const fs=require('node:fs');const files=JSON.parse(fs.readFileSync(0,'utf8'));for(const [name,data] of Object.entries(files)){if(!/^prisma\\/(?:schema\\.prisma|migrations\\/(?:migration_lock\\.toml|[a-z0-9_]+\\/migration\\.sql))$/.test(name))process.exit(1);fs.mkdirSync(require('node:path').dirname('/work/'+name),{recursive:true});fs.writeFileSync('/work/'+name,Buffer.from(data,'base64'));}`;
export function createNativeAdapter(config, dependencies = {}) {
  validateConfiguration(config);
  const io = dependencies.fs ?? fs, execute = dependencies.execute ?? spawnSync;
  const budget = dependencies.budget ?? createBudget();
  const run = dependencies.runId ?? randomBytes(8).toString('hex');
  const password = dependencies.password ?? randomBytes(32).toString('hex');
  const url = cloneURL(run, password), database = `edi_r4_${run}`, referenceDB = `${database}_reference`;
  let workspace = null, env = null, imageId = null, pgImageId = null, schema = null, data = null, reference = null;
  const resources = [], cleanupCodes = [], source = {};
  const names = { network: `edi-r4-net-${run}`, db: `edi-r4-db-${run}`, client: `edi-r4-client-${run}`, image: `edi-r4-client-${run}:local` };
  let native = { exit: 0, timedOut: false }, buildComplete = false, workNative = null;
  const read = file => { budget.cap(1); return readRegular(file, io); };
  const command = (args, requested = 30000, input = undefined, extraEnv = {}) => {
    try { return nativeCommand(execute, 'docker', args, { cwd: workspace, env: { ...env, ...extraEnv }, timeout: budget.cap(requested), input }); }
    catch (error) { if (error.native) native = error.native; throw error; }
  };
  const inspect = (kind, name, timeout = 10000) => {
    // Only a recognized exact-name "No such" error establishes absence.
    const result = execute('docker', [kind, 'inspect', name], { cwd: workspace, env, timeout: budget.cap(timeout), shell: false, encoding: 'utf8', maxBuffer, windowsHide: true, killSignal: 'SIGKILL' });
    if (isInspectionAbsent(result, kind, name)) return null;
    try { return parseObject(nativeCommand(() => result, 'docker', [kind, 'inspect', name], { cwd: workspace, env, timeout: budget.cap(timeout) })); }
    catch (error) { if (error.native) native = error.native; throw error; }
  };
  const networkResource = () => resources.find(r => r.kind === 'network');
  const containerResource = name => resources.find(r => r.name === name);
  const sql = (text, db = database, timeout = 90000) => command(['exec', '-i', containerResource(names.db).id, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db], timeout, text);
  const prisma = (args, expectedExit = 0) => {
    const timeout = budget.cap(120000);
    const result = parseJSON(command(['exec', '-i', containerResource(names.client).id, 'node', '-e', PRISMA_WRAPPER], timeout,
      JSON.stringify({ url, args, timeout: Math.max(1, timeout - 1000) })));
    if (result.exit !== expectedExit || typeof result.output !== 'string') refuse();
    return result.output;
  };
  const catalog = () => assertCatalog(parseJSON(sql(CATALOG_SQL)), reference);
  const adapter = {
    runId: run,
    metadata: () => ({ native: workNative ?? native, ownedCleanup: cleanupCodes }),
    async buildPublicSidecar() {
      // Inputs must be reviewed ahead of this run. No lock generation or ambient
      // registry configuration is used. Any missing input fails before creation.
      for (const name of ['schema.sql', 'data.sql']) {
        const stat = io.lstatSync(path.join(config.artifacts, name));
        if (!stat.isFile() || stat.isSymbolicLink()) refuse();
      }
      const publicNames = io.readdirSync(config.publicInputs).sort();
      if (publicNames.join('|') !== 'package-lock.json|package.json') refuse();
      const pkg = read(path.join(config.publicInputs, 'package.json'));
      const lock = read(path.join(config.publicInputs, 'package-lock.json'));
      validatePublicInputs(pkg, lock, config);
      const dockerfile = read(path.join(config.repository, 'docker/local-r4/Dockerfile'));
      const prismaRoot = path.join(config.repository, 'prisma');
      const migrationRoot = path.join(prismaRoot, 'migrations');
      if (io.readdirSync(migrationRoot).filter(name => name !== 'migration_lock.toml').sort().join('|') !== Object.keys(MIGRATION_PINS).sort().join('|')) refuse();
      source['prisma/schema.prisma'] = read(path.join(prismaRoot, 'schema.prisma'));
      source['prisma/migrations/migration_lock.toml'] = read(path.join(migrationRoot, 'migration_lock.toml'));
      for (const [name, pin] of Object.entries(MIGRATION_PINS)) {
        const bytes = read(path.join(migrationRoot, name, 'migration.sql'));
        if (sha(bytes) !== pin) refuse();
        source[`prisma/migrations/${name}/migration.sql`] = bytes;
      }
      workspace = io.mkdtempSync(path.join(dependencies.tmpdir ?? os.tmpdir(), 'edi-r4-'));
      const build = path.join(workspace, 'public'), configPath = path.join(workspace, 'docker-config');
      io.mkdirSync(build); io.mkdirSync(configPath);
      io.writeFileSync(path.join(configPath, 'config.json'), '{}', { mode: 0o600 });
      env = commandEnvironment(dependencies.ambient ?? process.env, configPath, dependencies.platform ?? process.platform);
      io.writeFileSync(path.join(build, 'package.json'), pkg);
      io.writeFileSync(path.join(build, 'package-lock.json'), lock);
      io.writeFileSync(path.join(build, 'Dockerfile'), dockerfile);
      assertContext(io.readdirSync(build));
      // Explicit legacy builder avoids the unavailable Compose plugin/Buildx.
      // If Desktop disables legacy build, this command fails closed before restore.
      const version = parseJSON(command(['version', '--format', '{{json .Server}}']));
      if (version.Os !== 'linux') refuse();
      if (inspect('image', names.image) !== null) refuse();
      resources.push({ kind: 'image', name: names.image, attempted: true });
      command(['build', '--force-rm', '--platform', 'linux/amd64', '--pull', '--label', `${OWNER}=${run}`, '--build-arg', `NODE_IMAGE=${config.nodeImage}`, '--tag', names.image, '--iidfile', path.join(workspace, 'image.id'), build], 900000, undefined, { DOCKER_BUILDKIT: '0' });
      const image = inspect('image', names.image);
      imageId = assertImage(image, names.image, run);
      if (readRegular(path.join(workspace, 'image.id'), io).toString().trim() !== imageId) refuse();
      resources[0].id = imageId;
      assertImage(inspect('image', config.nodeImage), config.nodeImage);
      buildComplete = true;
      command(['pull', '--platform', 'linux/amd64', POSTGRES_IMAGE], 300000);
      pgImageId = assertImage(inspect('image', POSTGRES_IMAGE), POSTGRES_IMAGE);
    },
    async provision() {
      for (const [kind, name] of [['network', names.network], ['container', names.db], ['container', names.client]]) if (inspect(kind, name) !== null) refuse();
      const net = { kind: 'network', name: names.network, attempted: true }; resources.push(net);
      const networkId = command(['network', 'create', '--driver', 'bridge', '--internal', '--label', `${OWNER}=${run}`, names.network]).trim();
      if (!idPattern.test(networkId)) refuse(); net.id = networkId;
      assertNetwork(inspect('network', net.id), { ...net, run }, []);
      for (const [name, image, tmpfs] of [[names.db, POSTGRES_IMAGE, ['/var/lib/postgresql/data', '/var/run/postgresql', '/tmp']], [names.client, names.image, ['/work', '/tmp']]]) {
        const resource = { kind: 'container', name, attempted: true, tmpfs }; resources.push(resource);
        const args = ['create', '--log-driver=none', '--name', name, '--platform', 'linux/amd64', '--label', `${OWNER}=${run}`, '--network', names.network, '--read-only', '--memory=1g', '--cpus=2', '--pids-limit=128', '--security-opt=no-new-privileges', '--cap-drop=ALL'];
        // PG entrypoint requires chown/setuid/setgid to initialize its tmpfs.
        if (name === names.db) args.push('--cap-add=CHOWN', '--cap-add=SETUID', '--cap-add=SETGID', '--cap-add=DAC_OVERRIDE');
        for (const mount of tmpfs) args.push('--tmpfs', `${mount}:rw,nosuid,nodev,size=${mount === '/var/lib/postgresql/data' ? '768m' : mount === '/work' ? '32m' : '16m'},mode=1777`);
        if (name === names.db) args.push('--env', `POSTGRES_DB=${database}`, '--env', 'POSTGRES_USER=postgres', '--env', 'POSTGRES_PASSWORD', '--env', 'PGDATA=/var/lib/postgresql/data/pgdata', image);
        else args.push('--entrypoint', 'node', image, '-e', 'setInterval(()=>{},1000)');
        const containerId = command(args, 60000, undefined, name === names.db ? { POSTGRES_PASSWORD: password } : {}).trim();
        if (!idPattern.test(containerId)) refuse(); resource.id = containerId;
        command(['start', containerId]);
      }
    },
    async proveIsolationAndFilesystems() {
      const net = networkResource();
      assertNetwork(inspect('network', net.id), { ...net, run }, resources.filter(r => r.kind === 'container').map(r => r.id));
      for (const resource of resources.filter(r => r.kind === 'container')) {
        const pg = resource.name === names.db;
        assertIsolation(inspect('container', resource.id), { ...resource, run, network: names.network, networkId: net.id, imageId: pg ? pgImageId : imageId, imageReference: pg ? POSTGRES_IMAGE : names.image });
        for (const mount of resource.tmpfs) if (command(['exec', resource.id, 'stat', '-f', '-c', '%T', mount]).trim() !== 'tmpfs') refuse();
      }
      const files = Object.fromEntries(Object.entries(source).map(([name, bytes]) => [name, bytes.toString('base64')]));
      command(['exec', '-i', containerResource(names.client).id, 'node', '-e', WRITE_WRAPPER], 30000, JSON.stringify(files));
    },
    async connectionPreflight() {
      // No retries: a startup/connection failure terminates this epoch.
      const proof = sql(`SELECT split_part(version(),' ',2)||'|'||current_setting('server_version_num')||'|'||current_database()||'|'||current_user;\n`, database, 30000).trim();
      if (proof !== `17.6|170006|${database}|postgres`) refuse();
      const output = prisma(['migrate', 'diff', '--from-schema-datasource', '/work/prisma/schema.prisma', '--to-schema-datamodel', '/work/prisma/schema.prisma', '--script', '--exit-code'], 2);
      if (!['DailyPayDay', 'WorkerDayOperation', 'WorkerDayTruckSegment'].every(name => output.includes(name))) refuse();
    },
    async verifyPrivatePins() {
      const schemaBytes = read(path.join(config.artifacts, 'schema.sql'));
      const dataBytes = read(path.join(config.artifacts, 'data.sql'));
      // Injectable verifier lets unit tests use synthetic dumps without private bytes.
      // The CLI never exposes this dependency and always enforces the fixed pins.
      const verify = dependencies.verifyPinned ?? verifyPinned;
      verify(schemaBytes, ...DUMP_PINS['schema.sql']); verify(dataBytes, ...DUMP_PINS['data.sql']);
      const rawSchema = schemaBytes.toString('utf8');
      schema = filterSchema(rawSchema, config.omittedStatements);
      data = filterPublicCopy(dataBytes.toString('utf8'), [...rawSchema.matchAll(/CREATE TABLE IF NOT EXISTS "public"\."([^"]+)"/g)].map(m => m[1]));
    },
    async restorePublicOnlyAndValidateCircularFKs() {
      sql(schema);
      sql(`BEGIN; SET LOCAL session_replication_role=replica;\n${data}SET LOCAL session_replication_role=origin;\n${VALIDATE_SQL}COMMIT;\n`, database, 180000);
      schema = null; data = null;
    },
    async ledgerBefore() { assertLedger(sql(LEDGER_SQL), MIGRATION_PINS); },
    async correctiveSQL() { sql(source[`prisma/migrations/${Object.keys(MIGRATION_PINS)[5]}/migration.sql`].toString()); },
    async proveAllEffects() {
      sql(`CREATE DATABASE "${referenceDB}";\n`);
      sql(REFERENCE_BASE, referenceDB);
      for (const name of Object.keys(MIGRATION_PINS).slice(3, 6)) sql(source[`prisma/migrations/${name}/migration.sql`].toString(), referenceDB);
      reference = parseJSON(sql(CATALOG_SQL, referenceDB));
      catalog();
    },
    async diffOctoberPending() {
      const pinned = source[octoberMigration];
      if (!Buffer.isBuffer(pinned) || sha(pinned) !== MIGRATION_PINS['20261007161500_link_worker_day_mileage']) refuse();
      const output = prisma(['migrate', 'diff', '--from-schema-datasource', '/work/prisma/schema.prisma', '--to-schema-datamodel', '/work/prisma/schema.prisma', '--script', '--exit-code'], 2);
      assertPendingOctoberSQL(output, pinned.toString('utf8'));
    },
    async diff() {
      const output = prisma(['migrate', 'diff', '--from-schema-datasource', '/work/prisma/schema.prisma', '--to-schema-datamodel', '/work/prisma/schema.prisma', '--exit-code']).trim();
      if (output !== '' && output !== 'No difference detected.') refuse();
    },
    async resolve(name) { if (!Object.keys(MIGRATION_PINS).slice(3, 5).includes(name)) refuse(); prisma(['migrate', 'resolve', '--applied', name]); },
    async deploy() { prisma(['migrate', 'deploy']); },
    async catalog() { catalog(); assertOctoberCatalog(parseJSON(sql(OCTOBER_CATALOG_SQL))); },
    async ledgerAfter() { assertLedger(sql(LEDGER_SQL), MIGRATION_PINS, true); },
    async status() { prisma(['migrate', 'status']); },
    async cleanup() {
      workNative = { ...native };
      budget.beginCleanup();
      if (!workspace) return 'complete';
      const runtimeResources = resources.filter(r => r.kind !== 'image');
      const result = await cleanupOwned({ inspect,
        remove: async (id, kind, timeout) => {
          if (kind === 'container') {
            // Re-inspect independently before each destructive operation.
            const resource = runtimeResources.find(r => r.id === id) ?? runtimeResources.find(r => r.name === inspect(kind, id).Name.slice(1));
            resource.id = id;
            const check = () => {
              const current = inspect(kind, id);
              if (current?.Id !== id || current.Name !== '/' + resource.name || current.Config?.Labels?.[OWNER] !== run) refuse();
            };
            check();
            try { command(['stop', '--time', '5', id], timeout); cleanupCodes.push({ kind, id, operation: 'stop', exit: 0 }); }
            catch (error) { cleanupCodes.push({ kind, id, operation: 'stop', exit: error.native?.exit ?? null, timedOut: error.native?.timedOut ?? false }); }
            check(); command(['container', 'rm', '--force', id], timeout);
          } else command(['network', 'rm', id], timeout);
          cleanupCodes.push({ kind, id, operation: 'remove', exit: 0 });
        },
      }, runtimeResources, run, budget);
      for (const resource of runtimeResources) {
        if (!cleanupCodes.some(code => code.id === resource.id && code.operation === 'remove')) cleanupCodes.push({ kind: resource.kind, name: resource.name, operation: 'remove', exit: null });
      }
      let imageCleanup = buildComplete || !resources.some(r => r.kind === 'image');
      const built = resources.find(r => r.kind === 'image');
      if (built) {
        try {
          const image = inspect('image', built.id ?? built.name);
          if (image === null && built.id) refuse();
          if (image !== null) {
            const id = assertImage(image, built.name, run);
            if (built.id && built.id !== id) refuse();
            assertImage(inspect('image', id), built.name, run);
            command(['image', 'rm', id], 20000); cleanupCodes.push({ kind: 'image', operation: 'remove', exit: 0 });
          }
        } catch { imageCleanup = false; cleanupCodes.push({ kind: 'image', operation: 'remove', exit: null }); }
      }
      // Only this runner-created random directory is removed, never supplied paths.
      try { io.rmSync(workspace, { recursive: true, force: true }); } catch { imageCleanup = false; }
      return result === 'complete' && imageCleanup ? 'complete' : 'unknown-stop';
    },
  };
  return adapter;
}
