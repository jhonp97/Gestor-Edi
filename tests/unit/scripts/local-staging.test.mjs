import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { types } from 'node:util'
import * as staging from '../../../scripts/run-local-staging.mjs'
import StagingReporter, {
  ownedTarget, contextAllowed, inventoryContext as actualInventory, runtimeFiles,
  commandEnvironment, composeCommand, nativeSucceeded, smokeSummary,
} from '../../../scripts/run-local-staging.mjs'

// Map-backed public source fixtures only; no host filesystem mutation. No Docker, application, dotenv,
// generated client, package manager, browser, or default test runner is invoked.
const source = relative => readFileSync(new URL(`../../../${relative}`, import.meta.url), 'utf8')
const runner = source('scripts/run-local-staging.mjs')
const compose = source('docker/local-staging/compose.yaml')
const dockerfile = source('docker/local-staging/Dockerfile')
const config = source('playwright.staging.config.ts')
const smoke = source('tests/e2e/truck-workday-staging.spec.ts')
const id = '0123456789abcdef'

// In-memory only: these adapters never call host filesystem mutation APIs.
const entries = new Map()
let sequence = 1
const normalized = value => path.resolve(value)
const fs = {
  constants: { O_RDONLY: 0, O_NOFOLLOW: 1 },
  mkdtempSync(prefix) { const name = normalized(`${prefix}${sequence++}`); this.mkdirSync(name); return name },
  mkdirSync(file) {
    const name = normalized(file)
    if (!entries.has(name)) entries.set(name, { kind: 'dir', ino: sequence++, bytes: Buffer.alloc(0) })
    const parent = path.dirname(name)
    if (parent !== name && !entries.has(parent)) this.mkdirSync(parent)
  },
  writeFileSync(file, contents) { entries.set(normalized(file), { kind: 'file', ino: sequence++, bytes: Buffer.from(contents) }) },
  readFileSync(file, encoding) { const data = entries.get(typeof file === 'object' ? file.name : normalized(file)).bytes; return encoding ? data.toString(encoding) : Buffer.from(data) },
  existsSync(file) { return entries.has(normalized(file)) },
  lstatSync(file, options) {
    const entry = entries.get(normalized(file))
    if (!entry) throw new Error('Missing literal fixture')
    return { isSymbolicLink: () => entry.kind === 'link', isDirectory: () => entry.kind === 'dir', isFile: () => entry.kind === 'file',
      dev: 1n, ino: BigInt(entry.ino), size: options?.bigint ? BigInt(entry.bytes.length) : entry.bytes.length, mtimeNs: 0n, ctimeNs: 0n }
  },
  realpathSync(file) { const name = normalized(file); return entries.get(name)?.target ?? name },
  openSync(file) { return { name: normalized(file) } },
  fstatSync(fd, options) { return this.lstatSync(fd.name, options) },
  closeSync() {},
  renameSync(from, to) {
    from = normalized(from); to = normalized(to)
    for (const [name, entry] of [...entries]) if (name === from || name.startsWith(`${from}${path.sep}`)) {
      entries.set(to + name.slice(from.length), entry); entries.delete(name)
    }
  },
  symlinkSync(target, file) { entries.set(normalized(file), { kind: 'link', target: normalized(target), ino: sequence++, bytes: Buffer.alloc(0) }) },
  rmSync(file) { const root = normalized(file); for (const name of entries.keys()) if (name === root || name.startsWith(`${root}${path.sep}`)) entries.delete(name) },
}
fs.realpathSync.native = fs.realpathSync
const os = { tmpdir: () => normalized('literal-fixture-root') }
const inventoryContext = (root, io = fs, tracked) => actualInventory(root, io, () => tracked ??
  (normalized(root) === normalized('fixture') ? ['src/page.tsx', 'public/icon.svg'].map(relative => normalized(path.join(root, relative))) : [...entries.keys()]).filter(name => name.startsWith(`${normalized(root)}${path.sep}`) && entries.get(name)?.kind !== 'dir')
    .map(name => path.relative(root, name).replaceAll('\\', '/')).filter(name => /^(src|public)\//.test(name)).join('\0') + '\0')

// Actual function body with closed literal dependencies: no port, filesystem or child process access.
async function preflightLiteral(failure, cleanupFails = false, platform = 'win32', nativeResults = [], timing, probe = {}) {
  const stop = step => { if (failure === step) throw new Error('private-path secret stdout payload') }
  const io = {
    mkdtempSync() { stop('temp-create'); return 'owned-literal-temp' },
    chmodSync() { stop('temp-create') },
    mkdirSync() { stop('temp-layout') },
    writeFileSync(file) { stop(file.endsWith('compose.yaml') ? 'compose-copy' : 'secret-file-write') },
    readFileSync() { stop('compose-copy'); return 'public-compose' },
    rmSync() { if (cleanupFails) throw new Error('private cleanup payload') },
  }
  const execute = (program, args, options) => {
    probe.calls?.push({ program, args: Array.from(args), options })
    timing?.calls.push({ args, timeout: options.timeout })
    if (program === 'docker-compose' && args.join(' ') === 'version --short') {
      return probe.version ?? { status: 0, signal: null, stdout: '2.40.3-desktop.1\n', stderr: '' }
    }
    if (program === 'powershell.exe') stop('windows-acl')
    else if (program === 'docker-compose' || args[0] === 'compose') {
      if (timing && !args.includes('literal-cleanup')) timing.now = 45 * 60 * 1000
      else if (timing?.expireCleanup) timing.now += 5 * 60 * 1000
      if (nativeResults.length) return nativeResults.shift()
      stop('build')
    }
    else stop(args[0] === 'image' ? 'docker-image-check' : 'docker-resource-list')
    return { status: 0, signal: null, stdout: '', stderr: '' }
  }
  return vm.runInNewContext(`(${staging.runStaging.toString()})({ execute, clock })`, {
    clock: timing ? () => timing.now : () => 0,
    execute, fs: io, path, os: { tmpdir: () => 'literal-temp-root' }, ROOT: 'literal-public-root',
    process: { platform, env: {} }, randomBytes: () => Buffer.from(id, 'hex'), ownedTarget,
    portAvailable: async () => stop('port-check'),
    inventoryContext: () => { stop('source-inventory'); return [] },
    stageContext: () => stop('context-copy'), runtimeFiles: () => { stop('secret-file-write'); return { app: 'literal' } },
    commandEnvironment, nativeSucceeded, composeCommand, smokeSummary, Buffer,
    nativeFailure: staging.nativeFailure, performance,
    createBudget: staging.createBudget,
    cleanupOwned: must => {
      if (nativeResults.length || timing) must(['compose', 'literal-cleanup'])
      if (cleanupFails) throw new Error('private cleanup payload')
    },
  })
}

for (const step of ['port-check', 'source-inventory', 'temp-create', 'windows-acl', 'temp-layout',
  'context-copy', 'secret-file-write', 'compose-copy', 'docker-resource-list', 'docker-image-check']) {
  test(`preflight marker preserves private ${step} failure`, async () => {
    const report = await preflightLiteral(step, true)
    assert.equal(report.preflightStep, step)
    assert.equal(report.phase, 'preflight')
    assert.equal(report.passed, false)
    assert.equal(report.smoke, null)
    assert.equal(report.cleanup, ['port-check', 'source-inventory', 'temp-create'].includes(step) ? 'complete' : 'unknown-stop')
    assert.doesNotMatch(JSON.stringify(report), /private-path|payload|stdout|literal/)
  })
}
for (const platform of ['win32', 'linux']) {
  test(`preflight marker clears before later build failure on ${platform}`, async () => {
    const report = await preflightLiteral('build', true, platform)
    assert.equal(report.preflightStep, null)
    assert.equal(report.phase, 'build')
    assert.equal(report.cleanup, 'unknown-stop')
    assert.equal(report.smoke, null)
  })
}

for (const code of [null, 'ENOBUFS', 'ETIMEDOUT', 'ENOENT', 'EACCES', 'malicious secret path']) {
  test(`native metadata retains first main and cleanup failures: ${code}`, async () => {
    const report = await preflightLiteral(null, false, 'linux', [
      { status: code === null ? 1 : null, signal: code === null ? null : 'SIGKILL',
        error: code === null ? undefined : { code, message: 'malicious secret path', stack: 'private URL' },
        stdout: 'é', stderr: Buffer.from('雪') },
      { status: 2, signal: null, stdout: '', stderr: '' },
    ])
    assert.match(report.runId, /^[a-f0-9]{16}$/)
    assert.deepEqual(JSON.parse(JSON.stringify(report.failure)), {
      phase: 'build', status: code === null ? 1 : null, signal: code === null ? null : 'SIGKILL',
      errorCode: code === null ? null : code === 'malicious secret path' ? 'OTHER' : code,
      timedOut: code === 'ETIMEDOUT', stdoutBytes: 2, stderrBytes: 3,
    })
    assert.deepEqual(JSON.parse(JSON.stringify(report.cleanupFailure)), {
      phase: 'cleanup', status: 2, signal: null, errorCode: null,
      timedOut: false, stdoutBytes: 0, stderrBytes: 0,
    })
    assert.equal(report.passed, false)
    assert.equal(report.phase, 'build')
    assert.equal(report.cleanup, 'unknown-stop')
    assert.doesNotMatch(JSON.stringify(report), /malicious|secret|private|URL/)
  })
}

test('native metadata remains null for nonnative failure', async () => {
  const report = await preflightLiteral('source-inventory')
  assert.equal(report.failure, null)
  assert.equal(report.cleanupFailure, null)
  assert.equal(report.passed, false)
})

test('native metadata normalizes missing and invalid results without success', async () => {
  const report = await preflightLiteral(null, false, 'linux', [
    { status: '0', signal: 'malicious secret path', stdout: {}, stderr: undefined },
  ])
  assert.deepEqual(JSON.parse(JSON.stringify(report.failure)), {
    phase: 'build', status: null, signal: 'unknown', errorCode: null,
    timedOut: false, stdoutBytes: null, stderrBytes: null,
  })
  assert.equal(report.passed, false)
  assert.equal(report.cleanupFailure, null)
})

test('resource list helpers select volume names and retain other resource IDs', () => {
  // Source policy covers runStaging without executing filesystem or runtime setup.
  for (const implementation of [staging.runStaging]) {
    const helper = implementation.toString().match(/const list = kind =>[\s\S]*?filter\(Boolean\)/)?.[0]
    assert.ok(helper, 'resource list helper exists')
    assert.match(helper, /'--format', kind === 'volume' \? '{{\.Name}}' : '{{\.ID}}'/)
  }
})

function cleanupFixture(defect = '') {
  const project = ownedTarget(id).project
  const container = 'c'.repeat(64), network = 'b'.repeat(64), image = `sha256:${'d'.repeat(64)}`
  const calls = [], removed = new Set()
  let inspects = 0
  const execute = (args, timeout) => {
    calls.push(args)
    assert.equal(timeout, 15000)
    const [kind, operation] = args
    const filter = args.find(value => value.startsWith('label=') || value.startsWith('reference=') || value.startsWith('id=') || value.startsWith('name=')) ?? ''
    if (operation === 'rm') { if (defect === 'native failure') throw new Error('Literal cleanup failure'); removed.add(args.at(-1)); return '' }
    if (operation === 'ls') {
      if (kind === 'volume') return defect === 'volume' ? 'foreign-volume\n' : ''
      if (kind === 'image') {
        if (filter.includes('-browser:')) return ''
        if (defect === 'reused tag' && inspects >= 2 && filter.startsWith('reference=')) return `sha256:${'e'.repeat(64)}\n`
        return removed.has(image) ? '' : image + '\n'
      }
      if (filter.startsWith('name=')) return defect === 'replacement' ? 'e'.repeat(64) + '\n' : ''
      const resource = kind === 'container' ? container : network
      return removed.has(resource) ? '' : resource + '\n'
    }
    if (operation === 'inspect') {
      assert.equal(args.at(-1), kind === 'container' ? container : kind === 'network' ? network : image)
      const labels = { 'io.gestor-edi.local-staging': defect === 'owner' ? 'foreign' : id, 'com.docker.compose.project': project }
      if (kind === 'container') {
        inspects++
        if (defect === 'same-ID swap' && inspects > 1) labels['com.docker.compose.project'] = 'foreign'
        return JSON.stringify({ Id: container, Name: `/${project}-db-1`, Config: { Labels: { ...labels, 'com.docker.compose.service': 'db' } },
          HostConfig: { NetworkMode: `${project}_runtime` }, Mounts: [{ Type: defect === 'mount' ? 'volume' : 'tmpfs' }],
          NetworkSettings: { Networks: { runtime: { NetworkID: defect === 'topology' ? 'e'.repeat(64) : network } } } })
      }
      if (kind === 'network') return JSON.stringify({ Id: network, Name: `${project}_runtime`, Labels: { ...labels, 'com.docker.compose.network': 'runtime' },
        Driver: 'bridge', Internal: defect !== 'external', Containers: removed.has(container) ? {} : { [container]: {} } })
      return JSON.stringify({ Id: image, Config: { Labels: labels }, RepoTags: [`${project}-app:local`, ...(defect === 'extra tag' ? ['node:22'] : [])] })
    }
    assert.fail('Unexpected cleanup command')
  }
  return { execute, calls, container, network, image }
}

test('cleanup rechecks full immutable IDs and removes only those IDs', () => {
  const fixture = cleanupFixture()
  staging.cleanupOwned(fixture.execute, id, 'literal-compose')
  assert.deepEqual(fixture.calls.filter(args => args[1] === 'rm').map(args => args.at(-1)), [fixture.container, fixture.network, fixture.image])
  assert.equal(fixture.calls.some(args => args[0] === 'compose' || (args[0] === 'volume' && args[1] === 'rm')), false)
})
for (const defect of ['owner', 'volume', 'mount', 'topology', 'external', 'same-ID swap', 'extra tag', 'reused tag', 'replacement', 'native failure']) {
  test(`immutable cleanup refuses ${defect}`, () => {
    const fixture = cleanupFixture(defect)
    assert.throws(() => staging.cleanupOwned(fixture.execute, id, 'literal-compose'))
    assert.equal(fixture.calls.some(args => args[0] === 'volume' && args[1] === 'rm'), false)
    if (['owner', 'volume', 'mount', 'topology', 'external'].includes(defect)) assert.equal(fixture.calls.some(args => args[1] === 'rm'), false)
    if (['extra tag', 'reused tag'].includes(defect)) assert.equal(fixture.calls.some(args => args[0] === 'image' && args[1] === 'rm'), false)
  })
}

test('R3 cleanup enforces per-command output cap before continuing', () => {
  let calls = 0
  assert.throws(() => staging.cleanupOwned(() => { calls++; return ' '.repeat(256 * 1024 + 1) }, id), /Cleanup output/)
  assert.ok(calls <= 5)
})

test('R3 cleanup never invokes mutable Compose teardown', () => {
  const calls = []
  staging.cleanupOwned(args => { calls.push(args); return '' }, id, 'literal-compose')
  assert.equal(calls.some(args => args[0] === 'compose'), false)
})

test('R3 canonical indexed paths and untracked admission are closed', () => {
  assert.deepEqual(staging.parseSourcePaths('src/page.ts\0public/icon.svg\0'), ['src/page.ts', 'public/icon.svg'])
  for (const value of ['src/a.ts', '/src/a.ts\0', 'src/../a.ts\0', 'src\\a.ts\0', 'src/a.ts\0src/a.ts\0', 'src/.env\0']) {
    assert.throws(() => staging.parseSourcePaths(value))
  }
  assert.throws(() => staging.sourceInventory('src/page.ts\0', 'src/new.ts\0'))
})

test('R3 cleanup reserve cannot extend the total fifty-minute deadline', () => {
  let now = 0
  const budget = staging.createBudget(() => now)
  now = 49 * 60 * 1000
  budget.cleanup()
  assert.equal(budget.cap(99999999), 60 * 1000)
  now = 50 * 60 * 1000
  assert.throws(() => budget.cap(1), /Budget/)
})

test('R3 direct path admission rejects control characters and colon', () => {
  for (const value of ['src/a:b.ts', 'src/a\u0001.ts', 'public/a\u007f.svg']) assert.equal(contextAllowed(value), false)
})

test('R3 expired work retains a separate finite cleanup reserve', () => {
  let now = 0
  const budget = staging.createBudget(() => now)
  assert.equal(budget.cap(99999999), 45 * 60 * 1000)
  now = 45 * 60 * 1000
  assert.throws(() => budget.cap(1000), /Budget/)
  budget.cleanup()
  assert.equal(budget.cap(99999999), 5 * 60 * 1000)
  now += 5 * 60 * 1000
  assert.throws(() => budget.cap(1000), /Budget/)
  budget.cleanup()
  assert.throws(() => budget.cap(1000), /Budget/)
})

for (const expireCleanup of [false, true]) {
  test(`actual run expiry attempts independently capped cleanup: ${expireCleanup}`, async () => {
    const timing = { now: 0, calls: [], expireCleanup }
    const report = await preflightLiteral(null, false, 'linux', [], timing)
    assert.equal(report.phase, 'build')
    assert.equal(report.cleanup, expireCleanup ? 'unknown-stop' : 'complete')
    assert.equal(report.passed, false)
    const cleanup = timing.calls.find(call => call.args.includes('literal-cleanup'))
    assert.ok(cleanup)
    assert.equal(cleanup.timeout, 120000)
    assert.ok(timing.calls.every(call => call.timeout > 0 && call.timeout <= 45 * 60 * 1000))
  })
}

test('actual Git command path uses only two closed read-only inventories', () => {
  const calls = []
  const paths = staging.gitSourceInventory('literal-root', (program, args, options) => {
    calls.push(args)
    assert.equal(program, 'git')
    assert.equal(options.shell, false)
    assert.equal(options.env.GIT_OPTIONAL_LOCKS, '0')
    assert.equal(options.timeout, 123)
    assert.ok(Object.keys(options.env).every(key => ['GIT_OPTIONAL_LOCKS', 'GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL', 'PATH', 'SystemRoot', 'WINDIR'].includes(key)))
    return { status: 0, signal: null, stderr: '', stdout: args.includes('--cached') ? 'src/page.ts\0' : '' }
  }, () => 123)
  assert.deepEqual(paths, ['src/page.ts'])
  assert.deepEqual(calls, [['ls-files', '--cached', '-z', '--', 'src', 'public'], ['ls-files', '--others', '--exclude-standard', '-z', '--', 'src', 'public']])
})

test('content hash refuses same-inode same-size silent byte replacement', () => {
  const root = publicFixture(), destination = fs.mkdtempSync(path.join(os.tmpdir(), 'literal-copy-'))
  try {
    const inventory = inventoryContext(root)
    const entry = entries.get(normalized(path.join(root, 'src/nested/page.ts')))
    entry.bytes = Buffer.alloc(entry.bytes.length, 120)
    assert.throws(() => staging.stageContext(root, destination, inventory), /Context changed/)
  } finally { fs.rmSync(root); fs.rmSync(destination) }
})

// Only owned, nonsecret public fixtures; never inventory the repository in tests.
function publicFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edi-staging-public-test-'))
  fs.writeFileSync(path.join(root, 'OWNER'), 'local-staging-public-test')
  for (const relative of ['package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'next.config.ts',
    'postcss.config.mjs', 'eslint.config.mjs', 'prisma/schema.prisma',
    'docker/local-staging/Dockerfile', 'docker/local-staging/compose.yaml',
    'playwright.staging.config.ts', 'tests/e2e/truck-workday-staging.spec.ts',
    'scripts/run-local-staging.mjs', 'src/nested/page.ts', 'public/icon.svg']) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    fs.writeFileSync(path.join(root, relative), 'public-fixture')
  }
  return root
}

test('app favicon is admitted exactly once and copied from an owned public fixture', () => {
  assert.equal(contextAllowed('src/app/favicon.ico'), true)
  for (const relative of ['src/app/icon.ico', 'src/app/nested/favicon.ico',
    'src/other/favicon.ico', 'src/app/favicon.ICO', 'src/app/../app/favicon.ico',
    '/src/app/favicon.ico', 'src\\app\\favicon.ico']) {
    assert.equal(contextAllowed(relative), false, relative)
  }
  const root = publicFixture()
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'edi-staging-public-test-'))
  try {
    fs.mkdirSync(path.join(root, 'src/app'))
    fs.writeFileSync(path.join(root, 'src/app/favicon.ico'), 'public-favicon-fixture')
    const inventory = inventoryContext(root)
    assert.equal(inventory.filter(relative => relative === 'src/app/favicon.ico').length, 1)
    staging.stageContext(root, destination, inventory)
    assert.equal(fs.readFileSync(path.join(destination, 'src/app/favicon.ico'), 'utf8'), 'public-favicon-fixture')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(destination, { recursive: true, force: true })
  }
})

for (const defect of ['neighbor', 'symlink', 'oversize']) {
  test(`app favicon inventory retains ${defect} refusal`, () => {
    const root = publicFixture()
    try {
      fs.mkdirSync(path.join(root, 'src/app'))
      const icon = path.join(root, 'src/app/favicon.ico')
      fs.writeFileSync(icon, 'public-favicon-fixture')
      if (defect === 'neighbor') fs.writeFileSync(path.join(root, 'src/app/icon.ico'), 'public-neighbor-fixture')
      // Override only the selected literal inode metadata.
      const io = { ...fs, lstatSync(file, options) {
        const stat = fs.lstatSync(file, options)
        if (file !== icon || options?.bigint) return stat
        if (defect === 'symlink') return { ...stat, isSymbolicLink: () => true }
        if (defect === 'oversize') return { ...stat, size: 8 * 1024 * 1024 + 1,
          isSymbolicLink: () => false, isFile: () => true, isDirectory: () => false }
        return stat
      } }
      assert.throws(() => inventoryContext(root, io), /Context/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
}

for (const kind of ['ancestor', 'root', 'compose']) {
  test(`M1 Map-backed public fixture refuses inventoried ${kind} replacement`, () => {
    const root = publicFixture()
    const outsider = publicFixture()
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'edi-staging-public-test-'))
    fs.writeFileSync(path.join(destination, 'OWNER'), 'local-staging-public-test')
    let moved
    try {
      const inventory = inventoryContext(root)
      const changed = kind === 'root' ? root : path.join(root, kind === 'compose' ? 'docker/local-staging' : 'src/nested')
      moved = `${changed}-original`
      fs.renameSync(changed, moved)
      fs.symlinkSync(kind === 'root' ? outsider : path.join(outsider, kind === 'compose' ? 'docker/local-staging' : 'src/nested'), changed, 'junction')
      assert.equal(typeof staging.stageContext, 'function', 'guarded copy API exists')
      assert.throws(() => staging.stageContext(root, destination, inventory), /Context/)
      assert.equal(fs.existsSync(path.join(destination, 'src/nested/page.ts')), false)
    } finally {
      // These names were created exclusively by this test, never user files.
      fs.rmSync(root, { recursive: true, force: true })
      if (kind === 'root' && moved) fs.rmSync(moved, { recursive: true, force: true })
      fs.rmSync(outsider, { recursive: true, force: true })
      fs.rmSync(destination, { recursive: true, force: true })
    }
  })
}

test('M1 Map-backed public fixture copies unchanged inventory and rejects leaf replacement', () => {
  for (const replace of [false, true]) {
    const root = publicFixture()
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'edi-staging-public-test-'))
    fs.writeFileSync(path.join(destination, 'OWNER'), 'local-staging-public-test')
    try {
      const inventory = inventoryContext(root)
      if (replace) {
        const leaf = path.join(root, 'src/nested/page.ts')
        fs.renameSync(leaf, `${leaf}-original`)
        fs.writeFileSync(leaf, 'public-fixture')
        assert.throws(() => staging.stageContext(root, destination, inventory), /Context/)
      } else {
        staging.stageContext(root, destination, inventory)
        for (const relative of inventory) assert.equal(fs.readFileSync(path.join(destination, relative), 'utf8'), 'public-fixture')
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(destination, { recursive: true, force: true })
    }
  }
})

test('M2 bootstrap rejects wrong ownership before schema executor', () => {
  const commands = []
  const execute = args => {
    commands.push(args)
    return { status: 0, signal: null, stdout: args.includes('--detach') ? 'a'.repeat(64) + '\n' : args.includes('sh') ? `staging_${id}|staging_${id}|0\n` : 'foreign\n', stderr: '' }
  }
  assert.equal(typeof staging.bootstrapOwned, 'function', 'bootstrap admission API exists')
  assert.throws(() => staging.bootstrapOwned(execute, id, 'owned-compose', 'owned-network', '172.18.0.2'), /Bootstrap/)
  assert.equal(commands.some(args => args.includes('push')), false)
})

test('M3 clean client awaits token deletion and verification transactions', async () => {
  assert.equal(typeof staging.cleanClient, 'function', 'clean-client API exists')
  const events = []
  let token = 'public-fixture-token'
  const db = {
    objectStoreNames: { contains: name => name === 'auth' },
    close: () => events.push('close'),
    transaction(store, mode) {
      assert.equal(store, 'auth')
      events.push(mode)
      const tx = { objectStore: () => ({
        delete(key) { assert.equal(key, 'jwt-token'); queueMicrotask(() => { token = undefined; events.push('deleted'); tx.oncomplete() }); return {} },
        get(key) { assert.equal(key, 'jwt-token'); const req = {}; queueMicrotask(() => {
          req.result = token; req.onsuccess(); queueMicrotask(() => { events.push('verified'); tx.oncomplete() })
        }); return req },
      }) }
      return tx
    },
  }
  const storage = { clear: () => events.push('storage'), length: 0 }
  const indexedDB = { databases: async () => [{ name: 'flota-auth-db', version: 1 }], open(name) {
    assert.equal(name, 'flota-auth-db'); const request = {}; queueMicrotask(() => {
      request.result = db; request.onsuccess()
    }); return request
  } }
  await staging.cleanClient({ indexedDB, localStorage: storage, sessionStorage: storage })
  assert.deepEqual(events, ['storage', 'storage', 'readwrite', 'deleted', 'readonly', 'verified', 'close'])
})

const networkId = 'b'.repeat(64)
const dbId = 'c'.repeat(64)
const bootstrapId = 'a'.repeat(64)
const address = '172.18.0.2'
function bootstrapFixture(change = () => undefined) {
  const commands = []
  let bootstrapInspects = 0
  const execute = (args, timeout, input) => {
    commands.push(args)
    assert.equal(timeout, 30000)
    let stdout = ''
    if (args[0] === 'network') stdout = args.includes('{{.Id}}') ? networkId + '\n' : `true ${id}\n`
    else if (args[1] === 'ls') stdout = (args.some(value => value.startsWith('name=')) ? bootstrapId : dbId) + '\n'
    else if (args[1] === 'inspect') {
      const container = args.at(-1)
      if (container === bootstrapId) bootstrapInspects++
      stdout = `${container}|${id}|edi-staging-${id}|${container === dbId ? 'db' : 'app'}|true|1|${networkId}|${container === dbId ? address : '172.18.0.3'}\n`
    } else if (args[0] === 'compose') stdout = bootstrapId + '\n'
    else if (args.includes('sh')) stdout = `staging_${id}|staging_${id}|16384|0\n`
    else if (args.includes('-i')) {
      assert.ok(input.includes("['DATABASE_URL', 'DIRECT_URL']"))
      assert.ok(input.includes('SET TRANSACTION READ ONLY;'))
      stdout = JSON.stringify(['DATABASE_URL', 'DIRECT_URL'].map(endpoint => ({ endpoint,
        database: `staging_${id}`, role: `staging_${id}`, address, port: '5432', oid: '16384', readonly: 'on', tables: '0' }))) + '\n'
    }
    return change(args, { status: 0, signal: null, stdout, stderr: '' }, bootstrapInspects) ?? { status: 0, signal: null, stdout, stderr: '' }
  }
  return { commands, execute }
}

for (const defect of ['wrong bootstrap', 'wrong network', 'wrong one URL', 'container swap', 'missing result', 'permission', 'unknown exit', 'unexpected stderr']) {
  test(`M2 literal executor rejects ${defect} before schema child`, () => {
    const fixture = bootstrapFixture((args, result, inspects) => {
      if (defect === 'wrong bootstrap' && args[1] === 'inspect' && args.at(-1) === bootstrapId) return { ...result, stdout: result.stdout.replace('|app|', '|db|') }
      if (defect === 'wrong network' && args[1] === 'inspect') return { ...result, stdout: result.stdout.replace(networkId, 'd'.repeat(64)) }
      if (defect === 'container swap' && args[1] === 'ls' && args.some(value => value.startsWith('name=')) && inspects > 0) return { ...result, stdout: 'e'.repeat(64) + '\n' }
      if (args.includes('-i')) {
        if (defect === 'wrong one URL') return { ...result, stdout: result.stdout.replace('DIRECT_URL', 'DATABASE_URL') }
        if (defect === 'missing result') return { ...result, stdout: '' }
        if (defect === 'permission') return { ...result, status: 1 }
        if (defect === 'unknown exit') return { ...result, status: null }
        if (defect === 'unexpected stderr') return { ...result, stderr: 'literal-warning' }
      }
    })
    assert.throws(() => staging.bootstrapOwned(fixture.execute, id, 'owned-compose', networkId), /Bootstrap/)
    assert.equal(fixture.commands.some(args => args.includes('push')), false)
  })
}

test('M2 admits both endpoint sessions before schema on the SAME owned bootstrap', () => {
  const fixture = bootstrapFixture()
  staging.bootstrapOwned(fixture.execute, id, 'owned-compose', networkId)
  const proof = fixture.commands.findIndex(args => args.includes('-i'))
  const schema = fixture.commands.findIndex(args => args.includes('push'))
  assert.ok(proof > 0 && schema > proof)
  assert.equal(fixture.commands[schema][1], bootstrapId)
  assert.equal(fixture.commands.filter(args => args.includes('push')).length, 1)
})

test('M2 schema native failure remains fatal', () => {
  const fixture = bootstrapFixture((args, result) => args.includes('push') ? { ...result, status: 1 } : undefined)
  assert.throws(() => staging.bootstrapOwned(fixture.execute, id, 'owned-compose', networkId), /Bootstrap/)
})

test('M2 serialized imports use the Prisma CommonJS default export', () => {
  const body = staging.bootstrapQuery.toString()
  assert.match(body, /const \{ default: \{ PrismaClient \} \} = await import\('@prisma\/client'\)/)
  assert.match(body, /const \{ types: \{ isProxy \} \} = await import\('node:util'\)/)
  assert.doesNotMatch(body, /\brequire\s*\(/)
})

for (const defect of ['none', 'wrong DATABASE_URL session', 'wrong DIRECT_URL session', 'missing row', 'permission', 'disconnect', 'proxy row', 'getter row', 'unexpected field', 'readonly off', 'wrong role', 'wrong oid', 'nonempty schema']) {
  test(`M2 actual closed query program ${defect === 'none' ? 'admits' : 'rejects'} ${defect}`, async () => {
    const events = []
    const output = []
    const expected = { database: `staging_${id}`, role: `staging_${id}`, address, oid: '16384' }
    const urls = staging.runtimeFiles(id, count => Buffer.alloc(count, 1)).app.split('\n')
    const env = Object.fromEntries(urls.slice(0, 2).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]))
    // Distinct literal passwords prove both actual supplied URLs are used, not
    // one successful session replayed under two labels.
    env.DIRECT_URL = env.DIRECT_URL.replace('01'.repeat(32), '02'.repeat(32))
    class PrismaClient {
      constructor(options) { this.url = options.datasources.db.url; events.push(['client', this.url === env.DIRECT_URL ? 'direct' : 'database']) }
      async $transaction(callback) {
        const endpoint = this.url === env.DIRECT_URL ? 'DIRECT_URL' : 'DATABASE_URL'
        return callback({
          $executeRawUnsafe: async sql => { events.push(sql); return 0 },
          $queryRawUnsafe: async () => {
            events.push(['query', endpoint])
            if (defect === 'permission') throw new Error('Literal denied')
            if (defect === 'missing row') return []
            const row = { database: expected.database, role: expected.role, address, port: '5432', oid: '16384', readonly: 'on', tables: '0' }
            if (defect === `wrong ${endpoint} session`) row.address = '172.18.0.9'
            if (defect === 'getter row') Object.defineProperty(row, 'role', { get: () => { assert.fail('Untrusted getter must not run') }, enumerable: true })
            if (defect === 'unexpected field') row.extra = 'literal'
            if (defect === 'readonly off') row.readonly = 'off'
            if (defect === 'wrong role') row.role = 'foreign'
            if (defect === 'wrong oid') row.oid = '16385'
            if (defect === 'nonempty schema') row.tables = '1'
            return [defect === 'proxy row' ? new Proxy(row, {}) : row]
          },
        })
      }
      async $disconnect() { events.push('disconnect'); if (defect === 'disconnect') throw new Error('Literal close failure') }
    }
    // Intercept only the two asserted literal import expressions: VM native
    // import hooks require experimental flags. Never resolve the real SDK.
    const body = staging.bootstrapQuery.toString()
    const imports = ["import('@prisma/client')", "import('node:util')"]
    for (const expression of imports) assert.equal(body.split(expression).length, 2)
    const literalBody = imports.reduce((text, expression) => text.replace(expression,
      expression.replace('import(', 'literalImport(')), body)
    assert.doesNotMatch(literalBody, /\bimport\s*\(/)
    const imported = []
    const promise = vm.runInNewContext(`(${literalBody})()`, {
      literalImport: async name => {
        imported.push(name)
        if (name === 'node:util') return { types }
        assert.equal(name, '@prisma/client')
        // Prisma 5.22 default.js exports module.exports via object spread.
        // Node guarantees its default namespace slot, not inferred named exports.
        return { default: { PrismaClient } }
      },
      process: { argv: ['node', '-', JSON.stringify(expected)], env, stdout: { write: value => output.push(value) } }, URL,
    })
    if (defect === 'none') {
      await promise
      assert.equal(output.length, 1)
      assert.deepEqual(events.filter(event => Array.isArray(event) && event[0] === 'query'), [['query', 'DATABASE_URL'], ['query', 'DIRECT_URL']])
      for (const position of [1, 6]) assert.equal(events[position], 'SET TRANSACTION READ ONLY;')
    } else { await assert.rejects(promise); assert.equal(output.length, 0) }
    assert.deepEqual(imported, ['@prisma/client', 'node:util'])
    assert.ok(events.includes('disconnect'))
  })
}

for (const defect of ['blocked', 'error', 'upgrade', 'missing store', 'abort', 'remaining token']) {
  test(`M3 clean client fails closed on ${defect}`, async () => {
    const closed = []
    const db = { close: () => closed.push(true), objectStoreNames: { contains: () => defect !== 'missing store' },
      transaction() {
        const tx = { objectStore: () => ({
          delete: () => { queueMicrotask(() => defect === 'abort' ? tx.onabort() : tx.oncomplete()); return {} },
          get: () => { const request = {}; queueMicrotask(() => { request.result = 'literal-token'; request.onsuccess(); tx.oncomplete() }); return request },
        }) }
        return tx
      } }
    const indexedDB = { databases: async () => [{ name: 'flota-auth-db', version: 1 }], open() {
      const request = { result: db, transaction: { abort: () => closed.push('aborted') } }
      queueMicrotask(() => {
        if (['blocked', 'error', 'upgrade'].includes(defect)) {
          request[{ blocked: 'onblocked', error: 'onerror', upgrade: 'onupgradeneeded' }[defect]]()
          request.onsuccess() // Late success must close, never admit.
        } else request.onsuccess()
      })
      return request
    } }
    await assert.rejects(staging.cleanClient({ indexedDB, localStorage: { clear() {}, length: 0 }, sessionStorage: { clear() {}, length: 0 } }), /Clean client/)
    assert.ok(closed.includes(true))
  })
}

test('M3 missing owned DB leaves foreign databases untouched', async () => {
  await staging.cleanClient({ indexedDB: { databases: async () => [{ name: 'foreign-db', version: 1 }], open() { assert.fail('Foreign DB must not open') } },
    localStorage: { clear() {}, length: 0 }, sessionStorage: { clear() {}, length: 0 } })
})

test('staging accepts only the explicit owned run target', () => {
  assert.deepEqual(ownedTarget(id), {
    project: `edi-staging-${id}`, database: `staging_${id}`, role: `staging_${id}`,
  })
  for (const value of ['', 'production', '../escape', 'a'.repeat(64), null, 'A'.repeat(16)]) {
    assert.throws(() => ownedTarget(value), /Invalid staging target/)
  }
})

test('context enumerates public sources and exact build/config inputs', () => {
  for (const value of ['src/app/page.tsx', 'src/app/globals.css', 'src/lib/jwt-secret.ts',
    'public/icons/icon.png', 'public/manifest.json', 'package.json', 'pnpm-lock.yaml',
    'prisma/schema.prisma', 'docker/local-staging/Dockerfile',
    'tests/e2e/truck-workday-staging.spec.ts', 'scripts/run-local-staging.mjs']) {
    assert.equal(contextAllowed(value), true, value)
  }
})

test('context refuses secret names, discovery configuration, clients and private material', () => {
  for (const value of ['.env', '.env.local', 'src/.env', 'src/credentials.json',
    'src/lib/secrets.ts', 'src/private/key.ts', 'public/backup.json', 'public/database.dump',
    'public/key.pem', 'public/token.key', 'node_modules/index.js', '.next/index.js',
    '.git/config', 'prisma/seed.ts', 'prisma/prisma.config.ts', 'pnpm-workspace.yaml',
    'vitest.config.ts', 'playwright.config.ts', 'scripts/lib/client.mjs']) {
    assert.equal(contextAllowed(value), false, value)
  }
})

test('context rejects traversal, absolute, backslash and empty components', () => {
  for (const value of ['../src/page.ts', 'src/../page.ts', '/src/page.ts',
    'C:/src/page.ts', 'src\\page.ts', 'src//page.ts', 'src/./page.ts', '', null]) {
    assert.equal(contextAllowed(value), false)
  }
})

function literalInventory(overrides = {}) {
  const stat = kind => ({
    isSymbolicLink: () => kind === 'link', isDirectory: () => kind === 'dir',
    isFile: () => kind === 'file', size: 100, dev: 1n, ino: 1n, mtimeNs: 0n, ctimeNs: 0n,
  })
  return {
    constants: fs.constants,
    openSync: file => ({ name: file }),
    readFileSync: () => Buffer.alloc(100),
    fstatSync: () => stat('file'),
    closeSync() {},
    realpathSync: file => path.resolve(file),
    lstatSync(file) {
      const relative = path.relative(path.resolve('fixture'), path.resolve(file)).replaceAll('\\', '/')
      if (overrides[relative]) return stat(overrides[relative])
      const isFile = /\.(json|yaml|ts|tsx|mjs|css|svg|prisma)$/.test(relative) || relative.endsWith('Dockerfile')
      return stat(isFile ? 'file' : 'dir')
    },
    readdirSync(file) {
      const relative = path.relative(path.resolve('fixture'), path.resolve(file)).replaceAll('\\', '/')
      return relative === 'src' ? ['page.tsx'] : relative === 'public' ? ['icon.svg'] : []
    },
  }
}

test('finite inventory includes only explicit roots and named files', () => {
  const files = inventoryContext('fixture', literalInventory())
  assert.equal(files.length, 14)
  assert.ok(files.includes('src/page.tsx'))
  assert.ok(files.includes('public/icon.svg'))
  assert.ok(files.every(contextAllowed))
})

for (const [label, overrides] of [
  ['source file link', { 'src/page.tsx': 'link' }],
  ['source directory link', { src: 'link' }],
  ['named config link', { 'package.json': 'link' }],
  ['named ancestor link', { 'docker/local-staging': 'link' }],
  ['nonregular source', { 'src/page.tsx': 'socket' }],
]) {
  test(`inventory refuses ${label}`, () => {
    assert.throws(() => inventoryContext('fixture', literalInventory(overrides)), /Context/)
  })
}

test('inventory rejects a dotenv name before reading it', () => {
  const io = literalInventory()
  assert.throws(() => inventoryContext('fixture', io, 'src/.env\0'), /Context/)
})

test('runtime credentials are fresh-generator inputs and restricted to the owned database', () => {
  const calls = []
  const files = runtimeFiles(id, count => { calls.push(count); return Buffer.alloc(count, calls.length) })
  assert.deepEqual(calls, [32, 32, 16])
  const values = Object.fromEntries(files.app.trim().split('\n').map(line => {
    const equals = line.indexOf('=')
    return [line.slice(0, equals), line.slice(equals + 1)]
  }))
  assert.equal(values.DATABASE_URL, values.DIRECT_URL)
  const url = new URL(values.DATABASE_URL)
  assert.equal(url.hostname, 'db')
  assert.equal(url.port, '5432')
  assert.equal(url.pathname, `/staging_${id}`)
  assert.equal(url.username, `staging_${id}`)
  assert.equal(values.AUTH_SECRET, values.NEXTAUTH_SECRET)
  assert.equal(Buffer.byteLength(values.DNI_ENCRYPTION_KEY, 'utf8'), 32)
  assert.deepEqual(Object.keys(values), ['DATABASE_URL', 'DIRECT_URL', 'NEXTAUTH_SECRET', 'AUTH_SECRET', 'DNI_ENCRYPTION_KEY'])
  assert.ok(!files.app.includes('SKIP_AUTH'))
  assert.ok(!files.app.includes('RESEND'))
  assert.ok(!files.app.includes('GOOGLE'))
})

test('runtime credential generator failure closes the target', () => {
  assert.throws(() => runtimeFiles(id, () => Buffer.alloc(0)), /Secret generation failed/)
})

test('Docker environment never inherits provider, target, home or compose configuration', () => {
  const forbidden = 'forbidden'
  const env = commandEnvironment({ PATH: 'literal-path', SystemRoot: 'literal-os',
    DATABASE_URL: forbidden, DIRECT_URL: forbidden, SKIP_AUTH: 'true',
    GOOGLE_CLIENT_SECRET: forbidden, RESEND_API_KEY: forbidden, HOME: forbidden,
    DOCKER_HOST: forbidden, DOCKER_CONTEXT: forbidden, COMPOSE_FILE: forbidden,
    NODE_OPTIONS: forbidden, PNPM_HOME: forbidden }, 'owned-empty-config')
  assert.deepEqual(env, { DOCKER_CONFIG: 'owned-empty-config', COMPOSE_DISABLE_ENV_FILE: '1',
    DOCKER_HOST: process.platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock',
    PATH: 'literal-path', SystemRoot: 'literal-os' })
})

test('standalone Compose is preflighted once and mapped without changing project arguments', async () => {
  for (const platform of ['win32', 'linux']) {
    const calls = []
    const report = await preflightLiteral('build', false, platform, [], undefined, { calls })
    assert.equal(report.phase, 'build')
    const composeCalls = calls.filter(call => call.program === 'docker-compose')
    assert.equal(composeCalls.length, 2)
    assert.deepEqual(composeCalls[0].args, ['version', '--short'])
    assert.deepEqual(composeCalls[1].args, ['--project-name', `edi-staging-${id}`, '--file', path.join('owned-literal-temp', 'compose.yaml'), 'build', 'app', 'browser'])
    for (const call of calls.filter(call => ['docker', 'docker-compose'].includes(call.program))) {
      assert.equal(call.options.env.DOCKER_HOST, platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock')
      assert.equal(call.options.env.DOCKER_CONTEXT, undefined)
      assert.equal(call.options.shell, false)
      assert.notEqual(call.args[0], 'compose')
    }
    assert.ok(calls.some(call => call.program === 'docker' && call.args[0] === 'container'))
  }
})

for (const stdout of ['1.29.2\n', '3.0.0\n', '2.40\n', '2.40.3\nextra', '2.40.3-\n', '2.040.3\n']) {
  test(`unsupported Compose version fails before resources: ${JSON.stringify(stdout)}`, async () => {
    const calls = []
    const report = await preflightLiteral('build', false, 'linux', [], undefined, {
      calls, version: { status: 0, signal: null, stdout, stderr: '' },
    })
    assert.equal(report.phase, 'preflight')
    assert.equal(report.preflightStep, 'compose-version')
    assert.equal(report.cleanup, 'complete')
    assert.equal(calls.filter(call => call.program === 'docker-compose').length, 1)
    assert.equal(calls.some(call => call.program === 'docker'), false)
  })
}

test('compose invocation is project-scoped and never ambient/default', () => {
  assert.deepEqual(composeCommand(`edi-staging-${id}`, 'owned-compose', ['up', '--detach', 'db']),
    ['compose', '--project-name', `edi-staging-${id}`, '--file', 'owned-compose', 'up', '--detach', 'db'])
  assert.throws(() => composeCommand('production', 'owned-compose', []), /Invalid staging target/)
})

for (const [label, result] of [
  ['nonzero exit', { status: 1, signal: null }], ['signal', { status: 0, signal: 'SIGTERM' }],
  ['unknown status', { status: null, signal: null }], ['missing signal', { status: 0 }],
  ['spawn failure', { status: 0, signal: null, error: { code: 'ENOENT' } }],
  ['timeout', { status: null, signal: 'SIGKILL', error: { code: 'ETIMEDOUT' } }],
]) {
  test(`native admission rejects ${label}`, () => assert.equal(nativeSucceeded(result), false))
}

test('native admission requires a retained normal zero exit', () => {
  assert.equal(nativeSucceeded({ status: 0, signal: null }), true)
})

test('bounded smoke summary requires exactly one successful real test', () => {
  const line = 'STAGING_SMOKE {"passed":1,"failed":0,"skipped":0,"status":"passed"}\n'
  assert.deepEqual(smokeSummary(line), { passed: 1, failed: 0, skipped: 0, status: 'passed' })
  for (const value of ['', line + line, line.replace('"passed":1', '"passed":0'),
    line.replace('"failed":0', '"failed":1'), line.replace('"skipped":0', '"skipped":1'),
    line.replace('"status":"passed"', '"status":"failed"'),
    line.replace('"status":"passed"', '"status":"passed","extra":true'), 'x'.repeat(4097)]) {
    assert.equal(smokeSummary(value), null)
  }
})

test('failed smoke retains counts without admitting runtime success', () => {
  const line = 'STAGING_SMOKE {"passed":0,"failed":1,"skipped":0,"status":"failed"}\n'
  assert.equal(smokeSummary(line), null)
  assert.deepEqual(smokeSummary(line, false), { passed: 0, failed: 1, skipped: 0, status: 'failed' })
})

test('reporter retains counts without printing errors or test payloads', () => {
  const reporter = new StagingReporter()
  reporter.onTestEnd({ title: 'not reported' }, { status: 'passed' })
  reporter.onTestEnd({}, { status: 'failed', error: 'not reported' })
  reporter.onTestEnd({}, { status: 'skipped' })
  assert.deepEqual([reporter.passed, reporter.failed, reporter.skipped], [1, 1, 1])
  assert.match(runner, /if \(process\.argv\[1\].*fileURLToPath\(import\.meta\.url\)/)
  assert.doesNotMatch(runner, /console\.(error|warn)|console\.log\([^\n]*(error|stdout|stderr|password)/)
})

test('production services isolate egress, ports, capabilities and writable paths', () => {
  assert.equal((compose.match(/127\.0\.0\.1:3000:3000/g) ?? []).length, 1)
  assert.match(compose, /internal: true/)
  assert.match(compose, /network_mode: service:app/)
  assert.match(compose, /cap_drop: \[ALL\]/)
  assert.match(compose, /no-new-privileges:true/)
  assert.match(compose, /read_only: true/)
  assert.match(compose, /pids_limit: 256/)
  assert.match(compose, /logging:\s+driver: none/)
  assert.equal((compose.match(/mem_limit:/g) ?? []).length, 3)
  assert.equal((compose.match(/cpus:/g) ?? []).length, 3)
  assert.doesNotMatch(compose, /5432:5432|privileged:|network_mode: host|docker\.sock|restart: always/)
  const browser = compose.split('  browser:')[1].split('\nnetworks:')[0]
  assert.doesNotMatch(browser, /\n    (networks|ports|env_file):/)
})

test('build is frozen Linux-only with explicit public lifecycle and no repository copy', () => {
  assert.match(dockerfile, /node:22\.22\.2-bookworm-slim/)
  assert.match(dockerfile, /pnpm@9\.15\.9/)
  assert.match(dockerfile, /pnpm install --frozen-lockfile --ignore-scripts/)
  assert.match(dockerfile, /pnpm rebuild @prisma\/engines esbuild/)
  assert.match(dockerfile, /generate --schema prisma\/schema\.prisma/)
  assert.match(dockerfile, /next build --webpack/)
  assert.match(dockerfile, /ENV NODE_ENV=production/)
  assert.match(dockerfile, /install --with-deps chromium/)
  assert.doesNotMatch(dockerfile, /COPY \.(?:\s|\/)|COPY node_modules|COPY \.next|COPY \.env|ARG .*SECRET|seed\.ts/)
  assert.doesNotMatch(dockerfile, /NEXTAUTH_SECRET=|AUTH_SECRET=|DNI_ENCRYPTION_KEY=/)
})

test('nonroot runtime can read staged public files despite private host modes', () => {
  assert.match(dockerfile, /COPY --chmod=0644 package\.json pnpm-lock\.yaml/)
  assert.match(dockerfile, /COPY --chmod=0644 prisma\/schema\.prisma/)
  assert.match(dockerfile, /COPY --from=build --chown=node:node \/app\/next\.config\.ts/)
  assert.match(dockerfile, /COPY --chown=node:node playwright\.staging\.config\.ts/)
  assert.match(dockerfile, /COPY --chown=node:node scripts\/run-local-staging\.mjs/)
  assert.match(dockerfile, /COPY --chown=node:node tests\/e2e\/truck-workday-staging\.spec\.ts/)
})

test('bootstrap follows owned empty-database verification and is schema-only', () => {
  assert.match(runner, /SELECT current_database\(\), current_user/)
  assert.match(runner, /schemaname = 'public'/)
  assert.ok(runner.indexOf('Bootstrap endpoint proof refused') < runner.indexOf("'db', 'push'"))
  assert.match(runner, /'db', 'push', '--schema', 'prisma\/schema\.prisma', '--skip-generate'/)
  assert.doesNotMatch(runner, /accept-data-loss|migrate.*reset|migrate.*resolve|seed\.ts|TEST_DATABASE_URL/)
})

test('owned cleanup rejects foreign labels before any removal', async () => {
  const { cleanupOwned } = await import('../../../scripts/run-local-staging.mjs')
  const commands = []
  const executeLiteral = args => {
    commands.push(args)
    if (args[0] === 'container' && args[1] === 'ls') return 'aaaaaaaaaaaa\n'
    if (args[0] === 'container' && args[1] === 'inspect') return 'foreign foreign-project\n'
    return ''
  }
  assert.throws(() => cleanupOwned(executeLiteral, id, 'owned-compose'), /Ownership refused/)
  assert.equal(commands.some(args => args.includes('rm') || args.includes('down')), false)
})

test('owned cleanup failure is propagated rather than reported complete', async () => {
  const { cleanupOwned } = await import('../../../scripts/run-local-staging.mjs')
  const commands = []
  const executeLiteral = args => {
    commands.push(args)
    if (args[0] === 'container') throw new Error('Literal cleanup failure')
    return ''
  }
  assert.throws(() => cleanupOwned(executeLiteral, id, 'owned-compose'), /Literal cleanup failure/)
  assert.equal(commands.filter(args => args[0] === 'container').length, 1)
  assert.equal(commands.some(args => args[0] === 'image' && args[1] === 'rm'), false)
})

test('cleanup preserves first failure, uses owned labels and stops on unknown outcome', () => {
  assert.match(runner, /catch \{\s+primary = phase\s+\} finally/)
  const cleanup = runner.slice(runner.indexOf('} finally {\n    cleaning = true\n    budget.cleanup()'))
  assert.match(cleanup, /cleanupOwned\(must, id, composeFile\)/)
  const ownedCleanup = runner.slice(runner.indexOf('export function cleanupOwned'), runner.indexOf('export async function runStaging'))
  assert.ok(ownedCleanup.indexOf('Ownership refused') < ownedCleanup.indexOf("'container', 'rm'"))
  assert.match(ownedCleanup, /Image ownership refused/)
  assert.match(ownedCleanup, /Cleanup incomplete/)
  assert.match(cleanup, /cleanupFailed = true/)
  assert.match(cleanup, /primary === null && !cleanupFailed && summary !== null/)
  assert.match(cleanup, /'unknown-stop'/)
  assert.match(cleanup, /cleanupFailed \|\|= commandUncertain/)
  assert.doesNotMatch(runner, /prune|--remove-orphans|docker.*system.*rm/)
})

test('owned temp secrets are restricted before writes and removed in finally', () => {
  assert.ok(runner.indexOf('Set-Acl -LiteralPath') < runner.indexOf('const files = runtimeFiles(id)'))
  assert.match(runner, /fs\.chmodSync\(temporary, 0o700\)/)
  assert.match(runner, /flag: 'wx', mode: 0o600/)
  assert.match(runner, /fs\.rmSync\(temporary, \{ recursive: true, force: false \}\)/)
  assert.match(runner, /DOCKER_CONFIG: dockerConfig/)
})

test('localhost conflict stops without killing processes or retrying ports', () => {
  assert.match(runner, /host: '127\.0\.0\.1', port: 3000, exclusive: true/)
  assert.match(runner, /Port unavailable/)
  assert.doesNotMatch(runner, /taskkill|process\.kill|port\+\+|port \+ 1/)
})

test('browser configuration never starts a server or weakens production security', () => {
  assert.match(config, /retries: 0/)
  assert.match(config, /workers: 1/)
  assert.match(config, /baseURL: 'http:\/\/localhost:3000'/)
  assert.match(config, /browserName: 'chromium'/)
  assert.match(config, /chromiumSandbox: true/)
  assert.doesNotMatch(config, /^\s*webServer\s*:|reuseExistingServer|ignoreHTTPSErrors|--no-sandbox|--disable-web-security/m)
  assert.doesNotMatch(compose + dockerfile + runner, /SKIP_AUTH=|NODE_ENV=development|secure: false/)
})

test('smoke asserts real login, cookie-only session, protected denial and actual workday/readback/report', () => {
  assert.equal((smoke.match(/\ntest\('/g) ?? []).length, 1)
  assert.match(smoke, /import \{ cleanClient \} from '\.\.\/\.\.\/scripts\/run-local-staging\.mjs'/)
  assert.equal((smoke.match(/evaluate\(cleanClient, undefined\)/g) ?? []).length, 3)
  assert.doesNotMatch(smoke, /localStorage\.clear\(\)|sessionStorage\.clear\(\)/)
  assert.doesNotMatch(smoke, /test\.(skip|fixme)|@prisma|\.catch\(\(\) =>|if \(.*status/)
  for (const required of ["cookie?.httpOnly === true", "cookie?.secure === true", 'page.evaluate(cleanClient, undefined)',
    "expect('x-auth-token' in sentHeaders).toBe(false)", "expect('authorization' in sentHeaders).toBe(false)",
    "sentHeaders.cookie?.includes('auth-token=') === true", "'/api/auth/register'", '/api/auth/login',
    "'/api/trucks', 'POST'", "'/api/workers', 'POST'", "name: 'Guardar jornada'",
    "rateSnapshot: '75.25'", "Jornadas únicas de trabajadores: 1", '.status).toBe(404)',
    'expect(headerFallback).toBe(false)']) assert.ok(smoke.includes(required), required)
  assert.match(smoke, /url\.origin !== ORIGIN/)
  assert.match(smoke, /expect\(blocked\.length \+ anonymousBlocked\.length \+ otherBlocked\.length\)\.toBe\(0\)/)
})
