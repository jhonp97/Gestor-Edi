import * as fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import { randomBytes, createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OWNER = 'io.gestor-edi.local-staging'
const NAMED = new Set([
  'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'next.config.ts',
  'postcss.config.mjs', 'eslint.config.mjs', 'prisma/schema.prisma',
  'docker/local-staging/Dockerfile', 'docker/local-staging/compose.yaml', 'playwright.staging.config.ts',
  'tests/e2e/truck-workday-staging.spec.ts', 'scripts/run-local-staging.mjs',
])
// Exact indexed App Router metadata asset.
const SOURCE_ASSETS = new Set(['src/app/favicon.ico'])
const SOURCE_TYPES = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.json'])
const PUBLIC_TYPES = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.json', '.js', '.txt'])
const FORBIDDEN = /(?:^\.|env(?:\.|$)|secret|credential|backup|dump|private|\.pem$|\.key$|\.p12$|\.pfx$)/i
// Inspected public source module, not a credential file. No wildcard exception.
const PUBLIC_SOURCE_NAMES = new Set(['src/lib/jwt-secret.ts'])

export function ownedTarget(id) {
  if (typeof id !== 'string' || !/^[a-f0-9]{16}$/.test(id)) throw new Error('Invalid staging target')
  return { project: `edi-staging-${id}`, database: `staging_${id}`, role: `staging_${id}` }
}

export function contextAllowed(relative) {
  if (PUBLIC_SOURCE_NAMES.has(relative)) return true
  if (typeof relative !== 'string' || /[\x00-\x1f\x7f:]/.test(relative) || relative.includes('\\') || relative.startsWith('/') ||
      relative.split('/').some(part => !part || part === '..' || FORBIDDEN.test(part))) return false
  if (NAMED.has(relative) || SOURCE_ASSETS.has(relative)) return true
  return (relative.startsWith('src/') && SOURCE_TYPES.has(path.posix.extname(relative))) ||
    (relative.startsWith('public/') && PUBLIC_TYPES.has(path.posix.extname(relative)))
}

const INVENTORIES = new WeakMap()

function contextIdentity(file, directory, io) {
  const stat = io.lstatSync(file, { bigint: true })
  const canonical = io.realpathSync.native ? io.realpathSync.native(file) : io.realpathSync(file)
  // Junctions are links on Windows. Also reject reparse/path redirects whose
  // canonical location differs. dev/ino come from native file identity, not names.
  if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile()) ||
      path.resolve(canonical) !== path.resolve(file) || stat.ino === 0n ||
      stat.dev === undefined || stat.ino === undefined) throw new Error('Context identity refused')
  return [canonical, stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join('|')
}

export function parseSourcePaths(output) {
  if (typeof output !== 'string' || output.length > 256 * 1024 || (output && !output.endsWith('\0'))) throw new Error('Context inventory refused')
  const paths = output ? output.slice(0, -1).split('\0') : []
  if (paths.length > 1500 || new Set(paths).size !== paths.length || paths.some(relative =>
    !/^(src|public)\//.test(relative) || !contextAllowed(relative) || /[\x00-\x1f\x7f:\ufffd]/.test(relative))) throw new Error('Context inventory refused')
  return paths
}

export function sourceInventory(tracked, untracked) {
  const indexed = parseSourcePaths(tracked)
  if (parseSourcePaths(untracked).length) throw new Error('Untracked context refused')
  return Object.freeze(indexed)
}

export function gitSourceInventory(root, execute = spawnSync, cap = value => value) {
  const env = { GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' }
  for (const key of ['PATH', 'SystemRoot', 'WINDIR']) if (typeof process.env[key] === 'string') env[key] = process.env[key]
  const read = args => {
    const result = execute('git', ['ls-files', ...args, '-z', '--', 'src', 'public'], {
      cwd: root, env, shell: false, timeout: cap(15000), maxBuffer: 256 * 1024,
      encoding: 'utf8', windowsHide: true, killSignal: 'SIGKILL',
    })
    if (!nativeSucceeded(result) || result.stderr !== '') throw new Error('Context inventory refused')
    return result.stdout
  }
  return sourceInventory(read(['--cached']), read(['--others', '--exclude-standard']))
}

export function createBudget(clock = () => performance.now()) {
  const workDeadline = clock() + 45 * 60 * 1000
  let cleanupDeadline = null
  return {
    cleanup() { cleanupDeadline ??= workDeadline + 5 * 60 * 1000 },
    cap(requested) {
      const remaining = Math.floor((cleanupDeadline ?? workDeadline) - clock())
      if (remaining <= 0 || !Number.isFinite(requested) || requested <= 0) throw new Error('Budget exhausted')
      return Math.min(requested, remaining)
    },
  }
}

export function inventoryContext(root, io = fs, indexed = gitSourceInventory, checkBudget = () => {}) {
  root = path.resolve(root)
  const identities = new Map()
  const bind = (relative, directory) => {
    checkBudget()
    const identity = contextIdentity(path.join(root, relative), directory, io)
    if (identities.has(relative) && identities.get(relative).identity !== identity) throw new Error('Context changed')
    identities.set(relative, { directory, identity })
  }
  bind('', true)
  const inventory = []
  let totalBytes = 0
  const admit = relative => {
    if (!contextAllowed(relative)) throw new Error('Context file refused')
    const stat = io.lstatSync(path.join(root, relative))
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 8 * 1024 * 1024) {
      throw new Error('Context file refused')
    }
    totalBytes += Number(stat.size)
    if (totalBytes > 64 * 1024 * 1024) throw new Error('Context size exceeded')
    bind(relative, false)
    const fd = io.openSync(path.join(root, relative), io.constants.O_RDONLY | (io.constants.O_NOFOLLOW ?? 0))
    try {
      const opened = io.fstatSync(fd, { bigint: true })
      const canonical = io.realpathSync.native ? io.realpathSync.native(path.join(root, relative)) : io.realpathSync(path.join(root, relative))
      const descriptorIdentity = [canonical, opened.dev, opened.ino, opened.size, opened.mtimeNs, opened.ctimeNs].map(String).join('|')
      if (!opened.isFile() || descriptorIdentity !== identities.get(relative).identity) throw new Error('Context changed')
      const contents = io.readFileSync(fd)
      const after = io.fstatSync(fd, { bigint: true })
      if (contextIdentity(path.join(root, relative), false, io) !== identities.get(relative).identity || contents.length !== Number(opened.size) || after.size !== opened.size || after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs) throw new Error('Context changed')
      identities.get(relative).hash = createHash('sha256').update(contents).digest('hex')
    } finally { io.closeSync(fd) }
    inventory.push(relative)
  }
  for (const relative of NAMED) {
    // Every ancestor is checked; named files cannot sneak through a directory link.
    let parent = path.posix.dirname(relative)
    while (parent !== '.') {
      const stat = io.lstatSync(path.join(root, parent))
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Context directory refused')
      bind(parent, true)
      parent = path.posix.dirname(parent)
    }
    admit(relative)
  }
  const listed = indexed(root)
  const sources = typeof listed === 'string' ? parseSourcePaths(listed) : parseSourcePaths(listed.length ? listed.join('\0') + '\0' : '')
  for (const relative of sources) {
    let parent = path.posix.dirname(relative)
    while (parent !== '.') { bind(parent, true); parent = path.posix.dirname(parent) }
    admit(relative)
  }
  if (inventory.length > 1500) throw new Error('Context inventory exceeded')
  inventory.sort()
  Object.freeze(inventory)
  INVENTORIES.set(inventory, { root, identities, io })
  return inventory
}

export function runtimeFiles(id, entropy = randomBytes) {
  const target = ownedTarget(id)
  const password = entropy(32).toString('hex')
  const secret = entropy(32).toString('hex')
  // Hex encoding of sixteen random bytes is exactly 32 UTF-8 bytes.
  const encryption = entropy(16).toString('hex')
  if (![password, secret].every(value => /^[a-f0-9]{64}$/.test(value)) ||
      !/^[a-f0-9]{32}$/.test(encryption)) throw new Error('Secret generation failed')
  const url = `postgresql://${target.role}:${password}@db:5432/${target.database}?schema=public`
  return {
    db: `POSTGRES_DB=${target.database}\nPOSTGRES_USER=${target.role}\nPOSTGRES_PASSWORD=${password}\n`,
    app: `DATABASE_URL=${url}\nDIRECT_URL=${url}\nNEXTAUTH_SECRET=${secret}\nAUTH_SECRET=${secret}\nDNI_ENCRYPTION_KEY=${encryption}\n`,
  }
}

export function localDockerEndpoint(platform = process.platform) {
  return platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock'
}

export function commandEnvironment(ambient, dockerConfig, platform = process.platform) {
  const result = { DOCKER_CONFIG: dockerConfig, DOCKER_HOST: localDockerEndpoint(platform), COMPOSE_DISABLE_ENV_FILE: '1' }
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
    if (typeof ambient[key] === 'string') result[key] = ambient[key]
  }
  return result
}

export function composeCommand(project, composeFile, args) {
  if (!/^edi-staging-[a-f0-9]{16}$/.test(project)) throw new Error('Invalid staging target')
  return ['compose', '--project-name', project, '--file', composeFile, ...args]
}

export function nativeSucceeded(result) {
  return result?.status === 0 && result.signal === null && !result.error
}

// Closed native metadata only: never retain child output or error text.
export function nativeFailure(result, phase) {
  const signals = ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
    'SIGBUS', 'SIGFPE', 'SIGKILL', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE',
    'SIGALRM', 'SIGTERM', 'SIGCHLD', 'SIGCONT', 'SIGSTOP', 'SIGTSTP', 'SIGTTIN',
    'SIGTTOU', 'SIGURG', 'SIGXCPU', 'SIGXFSZ', 'SIGVTALRM', 'SIGPROF', 'SIGWINCH',
    'SIGIO', 'SIGPWR', 'SIGSYS', 'SIGBREAK']
  const code = result?.error?.code
  const bytes = output => typeof output === 'string' ? Buffer.byteLength(output, 'utf8') :
    Buffer.isBuffer(output) ? output.length : null
  return {
    phase: ['preflight', 'build', 'database', 'bootstrap', 'application', 'browser', 'cleanup'].includes(phase) ? phase : 'preflight',
    status: Number.isInteger(result?.status) ? result.status : null,
    signal: result?.signal === null ? null : signals.includes(result?.signal) ? result.signal : 'unknown',
    errorCode: result?.error ? ['ENOBUFS', 'ETIMEDOUT', 'ENOENT', 'EACCES'].includes(code) ? code : 'OTHER' : null,
    timedOut: code === 'ETIMEDOUT', stdoutBytes: bytes(result?.stdout), stderrBytes: bytes(result?.stderr),
  }
}

export function smokeSummary(output, successOnly = true) {
  const text = Buffer.isBuffer(output) ? output.toString('utf8') : output
  if (typeof text !== 'string' || text.length > 4096) return null
  const matches = text.split(/\r?\n/).filter(line => line.startsWith('STAGING_SMOKE '))
  if (matches.length !== 1) return null
  try {
    const result = JSON.parse(matches[0].slice(14))
    if (Object.keys(result).join(',') !== 'passed,failed,skipped,status' ||
        ![result.passed, result.failed, result.skipped].every(count => Number.isInteger(count) && count >= 0 && count <= 1) ||
        !['passed', 'failed', 'timedout', 'interrupted'].includes(result.status) ||
        result.passed + result.failed + result.skipped > 1) return null
    if (successOnly && (result.passed !== 1 || result.failed !== 0 || result.skipped !== 0 || result.status !== 'passed')) return null
    return result
  } catch { return null }
}

async function portAvailable(timeout = 5000) {
  await new Promise((resolve, reject) => {
    const server = net.createServer()
    const timer = setTimeout(() => { server.close(); reject(new Error('Port unavailable')) }, timeout)
    server.once('error', () => { clearTimeout(timer); reject(new Error('Port unavailable')) })
    server.listen({ host: '127.0.0.1', port: 3000, exclusive: true }, () => server.close(() => { clearTimeout(timer); resolve() }))
  })
}

export function stageContext(root, destination, inventory, checkBudget = () => {}) {
  const bound = INVENTORIES.get(inventory)
  if (!bound || bound.root !== path.resolve(root)) throw new Error('Context inventory refused')
  const fs = bound.io
  const validate = relative => {
    checkBudget()
    const expected = bound.identities.get(relative)
    if (!expected || contextIdentity(path.join(bound.root, relative), expected.directory, fs) !== expected.identity) {
      throw new Error('Context changed')
    }
  }
  // Reject any changed tree before producing output, including Compose.
  for (const relative of bound.identities.keys()) validate(relative)
  let bytes = 0
  for (const relative of inventory) {
    const ancestors = ['']
    let parent = path.posix.dirname(relative)
    while (parent !== '.') { ancestors.push(parent); parent = path.posix.dirname(parent) }
    const checkPath = () => { for (const ancestor of ancestors) validate(ancestor); validate(relative) }
    checkPath()
    const fd = fs.openSync(path.join(bound.root, relative), fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0))
    try {
      const opened = fs.fstatSync(fd, { bigint: true })
      const identity = [fs.realpathSync.native(path.join(bound.root, relative)), opened.dev, opened.ino,
        opened.size, opened.mtimeNs, opened.ctimeNs].map(String).join('|')
      if (!opened.isFile() || identity !== bound.identities.get(relative).identity || opened.size > 8n * 1024n * 1024n) {
        throw new Error('Context changed')
      }
      checkPath()
      bytes += Number(opened.size)
      if (bytes > 64 * 1024 * 1024) throw new Error('Context size exceeded')
      const contents = fs.readFileSync(fd)
      if (createHash('sha256').update(contents).digest('hex') !== bound.identities.get(relative).hash) throw new Error('Context changed')
      const after = fs.fstatSync(fd, { bigint: true })
      if (after.size !== opened.size || after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs || contents.length !== Number(opened.size)) {
        throw new Error('Context changed')
      }
      checkPath()
      const target = path.join(destination, relative)
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
      fs.writeFileSync(target, contents, { flag: 'wx', mode: 0o600 })
      checkPath()
    } finally { fs.closeSync(fd) }
  }
  for (const relative of bound.identities.keys()) validate(relative)
  // Descriptor + pre/post native identities bound practical replacement races;
  // this is not an adversarial-kernel or universally atomic filesystem guarantee.
}

// Closed stdin program: generated, image-local Prisma only; no app imports.
// Each actual environment URL has its own READ ONLY managed transaction.
export async function bootstrapQuery() {
  const { default: { PrismaClient } } = await import('@prisma/client')
  const { types: { isProxy } } = await import('node:util')
  let expected
  try { expected = JSON.parse(process.argv[2]) } catch { throw new Error('Refused') }
  const outputs = []
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    const url = process.env[key]
    let parsed
    try { parsed = new URL(url) } catch { throw new Error('Refused') }
    if (parsed.protocol !== 'postgresql:' || parsed.hostname !== 'db' || parsed.port !== '5432' ||
        parsed.username !== expected.role || parsed.pathname !== `/${expected.database}` ||
        parsed.search !== '?schema=public' || !/^[a-f0-9]{64}$/.test(parsed.password)) throw new Error('Refused')
    const client = new PrismaClient({ datasources: { db: { url } } })
    try {
      const proof = await client.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY;')
        await tx.$executeRawUnsafe('SET LOCAL search_path = pg_catalog;')
        const rows = await tx.$queryRawUnsafe("SELECT current_database()::text AS database, current_user::text AS role, inet_server_addr()::text AS address, inet_server_port()::text AS port, (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS oid, current_setting('transaction_read_only')::text AS readonly, (SELECT count(*)::text FROM pg_tables WHERE schemaname = 'public') AS tables")
        if (isProxy(rows) || !Array.isArray(rows) || rows.length !== 1 ||
            !Object.getOwnPropertyDescriptor(rows, '0')?.value) throw new Error('Refused')
        const row = Object.getOwnPropertyDescriptor(rows, '0').value
        if (isProxy(row) || row === null || typeof row !== 'object') throw new Error('Refused')
        const fields = ['database', 'role', 'address', 'port', 'oid', 'readonly', 'tables']
        const keys = Reflect.ownKeys(row)
        if (keys.some(key => typeof key !== 'string') || keys.sort().join(',') !== fields.slice().sort().join(',')) throw new Error('Refused')
        for (const field of fields) {
          const descriptor = Object.getOwnPropertyDescriptor(row, field)
          if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') throw new Error('Refused')
        }
        if (row.database !== expected.database || row.role !== expected.role || row.address !== expected.address ||
            row.port !== '5432' || row.oid !== expected.oid || row.readonly !== 'on' || row.tables !== '0') throw new Error('Refused')
        return { endpoint: key, ...row }
      }, { maxWait: 5000, timeout: 10000 })
      outputs.push(proof)
    } finally { await client.$disconnect() }
  }
  process.stdout.write(JSON.stringify(outputs) + '\n')
}

export function bootstrapOwned(execute, id, composeFile, network) {
  const target = ownedTarget(id)
  const checked = (args, input) => {
    const result = execute(args, 30000, input)
    if (!nativeSucceeded(result) || typeof result.stdout !== 'string' || result.stdout.length > 4096 || result.stderr !== '') {
      throw new Error('Bootstrap command refused')
    }
    return result.stdout
  }
  const identifier = value => {
    if (!/^[a-f0-9]{64}\n?$/.test(value)) throw new Error('Bootstrap identity refused')
    return value.trim()
  }
  const networkId = identifier(checked(['network', 'inspect', '--format', '{{.Id}}', network]))
  if (networkId !== network) throw new Error('Bootstrap network identity refused')
  if (checked(['network', 'inspect', '--format', `{{.Internal}} {{index .Labels "${OWNER}"}}`, network]).trim() !== `true ${id}`) {
    throw new Error('Bootstrap network refused')
  }
  const format = `{{.Id}}|{{index .Config.Labels "${OWNER}"}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{.State.Running}}|{{len .NetworkSettings.Networks}}|{{range .NetworkSettings.Networks}}{{.NetworkID}}|{{.IPAddress}}{{end}}`
  const inspect = (container, service) => {
    const values = checked(['container', 'inspect', '--format', format, container]).trim().split('|')
    if (values.length !== 8 || values[0] !== container || values[1] !== id || values[2] !== target.project ||
        values[3] !== service || values[4] !== 'true' || values[5] !== '1' || values[6] !== networkId ||
        !net.isIPv4(values[7])) throw new Error('Bootstrap ownership refused')
    return values[7]
  }
  const database = identifier(checked(['container', 'ls', '--all', '--no-trunc',
    '--filter', `label=com.docker.compose.project=${target.project}`,
    '--filter', 'label=com.docker.compose.service=db', '--format', '{{.ID}}']))
  const address = inspect(database, 'db')
  // Independently bind database OID as the available session/catalog marker.
  const socket = checked(['exec', database, 'sh', '-ec',
    'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT current_database(), current_user, (SELECT oid FROM pg_database WHERE datname = current_database()), (SELECT count(*) FROM pg_tables WHERE schemaname = \'public\')"'])
  const match = socket.match(new RegExp(`^${target.database}\\|${target.role}\\|([1-9][0-9]{0,9})\\|0\\n?$`))
  if (!match) throw new Error('Bootstrap fresh database refused')
  const expected = { database: target.database, role: target.role, address, oid: match[1] }
  const name = `${target.project}-bootstrap`
  const container = identifier(checked(composeCommand(target.project, composeFile,
    ['run', '--detach', '--no-deps', '--name', name, 'app', 'sleep', '180'])))
  const assertContext = () => {
    if (identifier(checked(['container', 'ls', '--all', '--no-trunc', '--filter', `name=^/${name}$`, '--format', '{{.ID}}'])) !== container) {
      throw new Error('Bootstrap unique container refused')
    }
    inspect(container, 'app')
    if (inspect(database, 'db') !== address) throw new Error('Bootstrap database changed')
  }
  assertContext()
  const script = `(${bootstrapQuery.toString()})().catch(() => { process.exitCode = 1 })`
  const proof = checked(['exec', '-i', container, 'node', '-', JSON.stringify(expected)], script)
  const canonical = ['DATABASE_URL', 'DIRECT_URL'].map(endpoint => ({ endpoint,
    database: target.database, role: target.role, address, port: '5432', oid: match[1], readonly: 'on', tables: '0' }))
  // Closed exact result; empty/multiple/malformed rows, extra fields and output fail.
  if (proof !== JSON.stringify(canonical) + '\n') throw new Error('Bootstrap endpoint proof refused')
  assertContext()
  checked(['exec', container, 'node', 'node_modules/prisma/build/index.js',
    'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'])
  assertContext()
}

// Self-contained browser function, also exercised against literal IndexedDB APIs.
// It neither touches cookies nor deletes a database or any foreign store/key.
export async function cleanClient(scope = globalThis) {
  const failure = () => new Error('Clean client refused')
  const bounded = (work, expire = () => {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { expire() } catch { reject(failure()); return }
      reject(failure())
    }, 5000)
    Promise.resolve().then(work).then(resolve, () => reject(failure())).finally(() => clearTimeout(timer))
  })
  scope.localStorage.clear()
  scope.sessionStorage.clear()
  if (scope.localStorage.length !== 0 || scope.sessionStorage.length !== 0) throw failure()
  const databases = await bounded(() => scope.indexedDB.databases())
  const owned = databases.filter(entry => entry.name === 'flota-auth-db')
  if (owned.length === 0) return
  if (owned.length !== 1 || owned[0].version !== 1) throw failure()
  let db
  try {
    let refused = false
    db = await bounded(() => new Promise((resolve, reject) => {
      const request = scope.indexedDB.open('flota-auth-db', 1)
      const deny = () => { refused = true; reject(failure()) }
      request.onerror = deny
      request.onblocked = deny
      request.onupgradeneeded = () => {
        deny()
        try { request.transaction?.abort() } catch { reject(failure()) }
      }
      request.onsuccess = () => {
        if (refused) { request.result.close(); return }
        resolve(request.result)
      }
    }), () => { refused = true })
    if (!db.objectStoreNames.contains('auth')) throw failure()
    let changed = false
    db.onversionchange = () => { changed = true; db.close() }
    const transaction = mode => {
      let tx
      return bounded(() => new Promise((resolve, reject) => {
        tx = db.transaction('auth', mode)
        let absent = false
        tx.onerror = tx.onabort = () => reject(failure())
        tx.oncomplete = () => mode === 'readwrite' || absent ? resolve() : reject(failure())
        const store = tx.objectStore('auth')
        const request = mode === 'readwrite' ? store.delete('jwt-token') : store.get('jwt-token')
        request.onerror = () => reject(failure())
        if (mode === 'readonly') request.onsuccess = () => { absent = request.result === undefined }
      }), () => tx?.abort())
    }
    await transaction('readwrite')
    await transaction('readonly')
    if (changed || scope.localStorage.length !== 0 || scope.sessionStorage.length !== 0) throw failure()
  } finally { db?.close() }
}

// Explicit owned cleanup, independently testable with literal command results.
// Callers provide a checked command executor, not arbitrary resource names.
export function cleanupOwned(execute, id) {
  const { project } = ownedTarget(id)
  let commands = 0
  const must = args => {
    if (++commands > 160) throw new Error('Cleanup bound exceeded')
    const output = execute(args, 15000)
    if (typeof output !== 'string' || output.length > 256 * 1024) throw new Error('Cleanup output refused')
    return output
  }
  const identifiers = output => {
    const values = output.trim() ? output.trim().split('\n') : []
    if (values.length > 16 || new Set(values).size !== values.length || values.some(value => !/^[a-f0-9]{64}$/.test(value))) throw new Error('Ownership refused')
    return values
  }
  const list = kind => {
    const output = must([kind, 'ls', ...(kind === 'container' ? ['--all'] : []),
      ...(kind === 'volume' ? [] : ['--no-trunc']), '--filter', `label=com.docker.compose.project=${project}`,
      '--format', kind === 'volume' ? '{{.Name}}' : '{{.ID}}'])
    if (kind === 'volume') {
      if (output.trim()) throw new Error('Project volume refused')
      return []
    }
    return identifiers(output)
  }
  const inspect = (kind, resource) => {
    let value
    try { value = JSON.parse(must([kind, 'inspect', '--format', '{{json .}}', resource])) } catch { throw new Error('Ownership refused') }
    if (!value || value.Id !== resource) throw new Error('Ownership refused')
    return value
  }
  const labels = value => value?.[OWNER] === id && value?.['com.docker.compose.project'] === project
  list('volume')
  const containers = list('container')
  const networks = list('network')
  if (networks.length > 1) throw new Error('Ownership refused')
  const checkNetwork = resource => {
    const value = inspect('network', resource)
    if (!labels(value.Labels) || value.Labels['com.docker.compose.network'] !== 'runtime' ||
        value.Name !== `${project}_runtime` || value.Driver !== 'bridge' || value.Internal !== true ||
        !value.Containers || Object.keys(value.Containers).some(key => !containers.includes(key))) throw new Error('Ownership refused')
    return value
  }
  const checkContainer = resource => {
    const value = inspect('container', resource)
    const service = value.Config?.Labels?.['com.docker.compose.service']
    if (!labels(value.Config?.Labels) || !['db', 'app', 'browser'].includes(service) ||
        typeof value.Name !== 'string' || !value.Name.startsWith(`/${project}-`) ||
        !Array.isArray(value.Mounts) || value.Mounts.some(mount => mount.Type !== 'tmpfs') ||
        !value.NetworkSettings?.Networks) throw new Error('Ownership refused')
    const bindings = value.HostConfig?.PortBindings ?? {}
    if (service !== 'app' && Object.keys(bindings).length) throw new Error('Ownership refused')
    if (service === 'app' && (Object.keys(bindings).some(port => port !== '3000/tcp') ||
        Object.values(bindings).some(values => !Array.isArray(values) || values.length !== 1 || values[0].HostIp !== '127.0.0.1' || values[0].HostPort !== '3000'))) throw new Error('Ownership refused')
    const attached = Object.values(value.NetworkSettings.Networks)
    if (service === 'browser') {
      const peer = value.HostConfig?.NetworkMode?.match(/^container:([a-f0-9]{64})$/)?.[1]
      if (attached.length !== 0 || !containers.includes(peer)) throw new Error('Ownership refused')
      const app = inspect('container', peer)
      if (!labels(app.Config?.Labels) || app.Config.Labels['com.docker.compose.service'] !== 'app') throw new Error('Ownership refused')
    } else if (attached.length !== 1 || !networks.includes(attached[0].NetworkID) || value.HostConfig?.NetworkMode !== `${project}_runtime`) throw new Error('Ownership refused')
    return value
  }
  const snapshots = new Map()
  for (const resource of networks) snapshots.set(resource, checkNetwork(resource))
  for (const resource of containers) snapshots.set(resource, checkContainer(resource))
  const names = containers.map(resource => snapshots.get(resource).Name)
  // Browser peers must remain available until their same-ID checks complete.
  const ordered = containers.slice().sort((a, b) => Number(snapshots.get(b).Config.Labels['com.docker.compose.service'] === 'browser') - Number(snapshots.get(a).Config.Labels['com.docker.compose.service'] === 'browser'))
  const absent = (kind, resource) => {
    const args = [kind, 'ls', ...(kind === 'container' ? ['--all'] : []), '--no-trunc', '--filter', `id=${resource}`, '--format', '{{.ID}}']
    if (identifiers(must(args)).length) throw new Error('Cleanup incomplete')
  }
  for (const resource of ordered) {
    if (JSON.stringify(checkContainer(resource)) !== JSON.stringify(snapshots.get(resource))) throw new Error('Ownership refused')
    must(['container', 'rm', '--force', resource])
    absent('container', resource)
  }
  for (const resource of networks) {
    const value = checkNetwork(resource)
    const initial = snapshots.get(resource)
    if (Object.keys(value.Containers).length || value.Name !== initial.Name || JSON.stringify(value.Labels) !== JSON.stringify(initial.Labels)) throw new Error('Ownership refused')
    must(['network', 'rm', resource])
    absent('network', resource)
    if (must(['network', 'ls', '--filter', `name=^${initial.Name}$`, '--format', '{{.ID}}']).trim()) throw new Error('Cleanup incomplete')
  }
  for (const name of names) if (must(['container', 'ls', '--all', '--no-trunc', '--filter', `name=^${name}$`, '--format', '{{.ID}}']).trim()) throw new Error('Cleanup incomplete')
  for (const kind of ['container', 'network', 'volume']) if (list(kind).length) throw new Error('Cleanup incomplete')
  for (const tag of [`${project}-app:local`, `${project}-browser:local`]) {
    const output = must(['image', 'ls', '--no-trunc', '--filter', `reference=${tag}`, '--format', '{{.ID}}']).trim()
    if (!output) continue
    if (!/^sha256:[a-f0-9]{64}$/.test(output)) throw new Error('Image ownership refused')
    const check = () => {
      const value = inspect('image', output)
      if (value.Config?.Labels?.[OWNER] !== id || !Array.isArray(value.RepoTags) || value.RepoTags.length !== 1 || value.RepoTags[0] !== tag) throw new Error('Image ownership refused')
      if (must(['image', 'ls', '--no-trunc', '--filter', `reference=${tag}`, '--format', '{{.ID}}']).trim() !== output) throw new Error('Image ownership refused')
      return JSON.stringify(value)
    }
    const snapshot = check()
    if (check() !== snapshot) throw new Error('Image ownership refused')
    must(['image', 'rm', output])
    if (must(['image', 'ls', '--all', '--no-trunc', '--format', '{{.ID}}']).trim().split('\n').includes(output) ||
        must(['image', 'ls', '--no-trunc', '--filter', `reference=${tag}`, '--format', '{{.ID}}']).trim()) throw new Error('Cleanup incomplete')
  }
  for (const kind of ['container', 'network', 'volume']) if (list(kind).length) throw new Error('Cleanup incomplete')
}

// Executor injection tests command policy, never claims real runtime proof.
export async function runStaging({ execute = spawnSync, clock = () => performance.now() } = {}) {
  const budget = createBudget(clock)
  const id = randomBytes(8).toString('hex')
  const target = ownedTarget(id)
  let temporary, environment, composeFile, resourcesPossible = false
  let phase = 'preflight', primary = null, cleanupFailed = false, summary = null
  // Closed operation marker: retained only for a preflight failure, never cleanup.
  let preflightStep = null
  let commandUncertain = false
  let failure = null, cleanupFailure = null, cleaning = false
  const run = (args, timeout = 120000, input) => {
    timeout = budget.cap(timeout)
    const result = execute(args[0] === 'compose' ? 'docker-compose' : 'docker', args[0] === 'compose' ? args.slice(1) : args, {
      cwd: temporary, env: environment, shell: false, timeout, input,
      maxBuffer: 1024 * 1024, killSignal: 'SIGKILL', encoding: 'utf8', windowsHide: true,
    })
    if (!nativeSucceeded(result)) {
      if (cleaning) cleanupFailure ??= nativeFailure(result, 'cleanup')
      else failure ??= nativeFailure(result, phase)
    }
    // A killed CLI cannot certify that a detached daemon/build operation stopped.
    if (result?.error || result?.signal !== null || !Number.isInteger(result?.status)) commandUncertain = true
    budget.cap(1)
    return result
  }
  const must = (args, timeout) => {
    const result = run(args, timeout)
    if (!nativeSucceeded(result)) throw new Error('Staging command failed')
    return result.stdout ?? ''
  }
  const compose = (args, timeout) => must(composeCommand(target.project, composeFile, args), timeout)
  const list = kind => must([kind, 'ls', ...(kind === 'container' ? ['--all'] : []),
    ...(kind === 'volume' ? [] : ['--no-trunc']),
    '--filter', `label=com.docker.compose.project=${target.project}`, '--format', kind === 'volume' ? '{{.Name}}' : '{{.ID}}']).trim().split(/\s+/).filter(Boolean)
  const verifyContainer = container => {
    const value = must(['container', 'inspect', '--format',
      `{{index .Config.Labels "${OWNER}"}} {{index .Config.Labels "com.docker.compose.project"}}`, container]).trim()
    if (value !== `${id} ${target.project}`) throw new Error('Ownership refused')
  }
  try {
    preflightStep = 'port-check'
    budget.cap(1)
    await portAvailable(budget.cap(5000))
    budget.cap(1)
    preflightStep = 'source-inventory'
    const inventory = inventoryContext(ROOT, fs, root => gitSourceInventory(root, execute, value => budget.cap(value)), () => budget.cap(1))
    preflightStep = 'temp-create'
    budget.cap(1)
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'edi-staging-'))
    fs.chmodSync(temporary, 0o700)
    if (process.platform === 'win32') {
      // NTFS ignores POSIX mode bits. Restrict this newly created directory to
      // the current SID before writing secrets; children inherit the private ACL.
      preflightStep = 'windows-acl'
      const acl = execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        '$ErrorActionPreference="Stop"; $p=$env:STAGING_PRIVATE_DIR; ' +
        '$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; ' +
        '$acl=New-Object System.Security.AccessControl.DirectorySecurity; ' +
        '$acl.SetAccessRuleProtection($true,$false); ' +
        '$rule=New-Object System.Security.AccessControl.FileSystemAccessRule(' +
        '$sid,"FullControl","ContainerInherit,ObjectInherit","None","Allow"); ' +
        '$acl.AddAccessRule($rule); Set-Acl -LiteralPath $p -AclObject $acl'], {
        cwd: temporary, env: { ...commandEnvironment(process.env, temporary), STAGING_PRIVATE_DIR: temporary },
        shell: false, timeout: budget.cap(15000), maxBuffer: 4096, encoding: 'utf8', windowsHide: true,
      })
      if (!nativeSucceeded(acl)) throw new Error('Private directory refused')
    }
    preflightStep = 'temp-layout'
    const context = path.join(temporary, 'context')
    const dockerConfig = path.join(temporary, 'docker-config')
    fs.mkdirSync(context, { mode: 0o700 })
    fs.mkdirSync(dockerConfig, { mode: 0o700 })
    environment = commandEnvironment(process.env, dockerConfig, process.platform)
    preflightStep = 'compose-version'
    const version = must(['compose', 'version', '--short'], 15000)
    // Accept one v2 semver, including Docker Desktop's vendor suffix; no banners.
    const number = '(?:0|[1-9][0-9]*)'
    const prerelease = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
    const semver = new RegExp(`^2\\.${number}\\.${number}(?:-${prerelease}(?:\\.${prerelease})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`)
    if (typeof version !== 'string' || version.length > 128 || !semver.test(version.replace(/\r?\n$/, ''))) {
      throw new Error('Compose version refused')
    }
    preflightStep = 'context-copy'
    budget.cap(1)
    stageContext(ROOT, context, inventory, () => budget.cap(1))
    budget.cap(1)
    preflightStep = 'secret-file-write'
    const files = runtimeFiles(id)
    for (const [name, contents] of Object.entries(files)) {
      fs.writeFileSync(path.join(temporary, `${name}.env`), contents, { flag: 'wx', mode: 0o600 })
    }
    preflightStep = 'compose-copy'
    composeFile = path.join(temporary, 'compose.yaml')
    // Compose bytes were copied through the same bound inventory/descriptor gate.
    fs.writeFileSync(composeFile, fs.readFileSync(path.join(context, 'docker/local-staging/compose.yaml')), { flag: 'wx', mode: 0o600 })
    Object.assign(environment, {
      STAGING_CONTEXT: context, STAGING_OWNER: id,
      STAGING_APP_ENV: path.join(temporary, 'app.env'), STAGING_DB_ENV: path.join(temporary, 'db.env'),
      STAGING_APP_IMAGE: `${target.project}-app:local`, STAGING_BROWSER_IMAGE: `${target.project}-browser:local`,
    })
    preflightStep = 'docker-resource-list'
    for (const kind of ['container', 'network', 'volume']) {
      if (list(kind).length) throw new Error('Existing project refused')
    }
    preflightStep = 'docker-image-check'
    for (const image of [environment.STAGING_APP_IMAGE, environment.STAGING_BROWSER_IMAGE]) {
      if (must(['image', 'ls', '--filter', `reference=${image}`, '--format', '{{.ID}}']).trim()) throw new Error('Existing image refused')
    }
    preflightStep = null
    resourcesPossible = true
    phase = 'build'
    compose(['build', 'app', 'browser'], 1800000)
    phase = 'database'
    compose(['up', '--detach', '--wait', '--wait-timeout', '90', 'db'])
    const networks = list('network')
    if (networks.length !== 1 || must(['network', 'inspect', '--format',
      `{{.Internal}} {{index .Labels "${OWNER}"}}`, networks[0]]).trim() !== `true ${id}`) throw new Error('Isolation refused')
    for (const container of list('container')) verifyContainer(container)
    phase = 'bootstrap'
    bootstrapOwned(run, id, composeFile, networks[0])
    phase = 'application'
    compose(['up', '--detach', '--wait', '--wait-timeout', '120', 'app'])
    for (const container of list('container')) verifyContainer(container)
    phase = 'browser'
    const result = run(composeCommand(target.project, composeFile, ['run', '--rm', '--no-deps', 'browser']), 240000)
    summary = smokeSummary(result.stdout, false)
    if (!nativeSucceeded(result) || !smokeSummary(result.stdout)) throw new Error('Smoke result refused')
  } catch {
    primary = phase
  } finally {
    cleaning = true
    budget.cleanup()
    if (resourcesPossible) {
      try {
        cleanupOwned(must, id, composeFile)
      } catch { cleanupFailed = true }
    }
    if (temporary) {
      try { budget.cap(1); fs.rmSync(temporary, { recursive: true, force: false }); budget.cap(1) } catch { cleanupFailed = true }
    }
  }
  cleanupFailed ||= commandUncertain
  return { passed: primary === null && !cleanupFailed && summary !== null,
    phase: primary ?? 'completed', preflightStep, cleanup: cleanupFailed ? 'unknown-stop' : 'complete', smoke: summary,
    runId: id, failure, cleanupFailure }
}

// A bounded reporter shares this passive module so failures never print cookies,
// credentials, application output, assertion payloads, or private paths.
export default class StagingReporter {
  passed = 0
  failed = 0
  skipped = 0
  onTestEnd(_test, result) {
    if (result.status === 'passed') this.passed++
    else if (result.status === 'skipped') this.skipped++
    else this.failed++
  }
  onEnd(result) {
    console.log(`STAGING_SMOKE ${JSON.stringify({ passed: this.passed,
      failed: this.failed, skipped: this.skipped, status: result.status })}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== 'run') {
    console.log(JSON.stringify({ passed: false, phase: 'invalid-command', cleanup: 'not-started' }))
    process.exitCode = 1
  } else {
    const result = await runStaging()
    console.log(JSON.stringify(result))
    process.exitCode = result.passed ? 0 : 1
  }
}
