import test from 'node:test';
import { Module } from 'node:module';
import * as harness from '../../../scripts/test-prisma-fresh-install.mjs';
import assert from 'node:assert/strict';
import { assertIdentity, assertCatalog, assertLedger, assertResource, verifyDatabase, runOwned, FILES } from '../../../scripts/test-prisma-fresh-install.mjs';

test('actual cleanup never removes a foreign replacement of a mutable name', () => {
  for (const type of ['container', 'network', 'image']) {
    const id = type === 'image' ? `sha256:${'a'.repeat(64)}` : 'a'.repeat(64);
    const foreignId = type === 'image' ? `sha256:${'b'.repeat(64)}` : 'b'.repeat(64);
    const owned = { Id: id, owner: 'owned' }, foreign = { Id: foreignId, owner: 'foreign' };
    const resources = new Map([[id, owned], [foreignId, foreign]]), removed = [], inspected = [];
    let named = owned;
    assert.throws(() => harness.cleanupResource({
      inspect: (_type, target) => {
        inspected.push(target);
        if (target === 'name') { const result = named; named = foreign; return result; }
        return resources.get(target) ?? null;
      },
      check: (_type, resource) => assert.equal(resource.owner, 'owned'),
      docker: args => { removed.push(args.at(-1)); resources.delete(args.at(-1)); },
    }, type, 'name'), /ownership/);
    assert.deepEqual(removed, [id]);
    assert.deepEqual(inspected, ['name', id, id, 'name']);
    assert.equal(resources.get(foreignId), foreign);
  }
});

test('cleanup rejects malformed or wrong-type IDs before removal', () => {
  for (const type of ['container', 'network', 'image', 'volume']) {
    for (const Id of [undefined, null, 123, {}, 'short', 'a'.repeat(63), 'A'.repeat(64), type === 'image' ? 'a'.repeat(64) : `sha256:${'a'.repeat(64)}`]) {
      let removed = false;
      assert.throws(() => harness.cleanupResource({ inspect: () => ({ Id }), check: () => {}, docker: () => { removed = true; } }, type, 'name'), /ownership/);
      assert.equal(removed, false);
    }
  }
});
test('cleanup rechecks exact-ID ownership and fails closed on ambiguous inspection', () => {
  const id = 'a'.repeat(64);
  for (const current of [null, { Id: 'b'.repeat(64), owner: true }, { Id: id, owner: false }]) {
    let removed = false, calls = 0;
    assert.throws(() => harness.cleanupResource({
      inspect: () => ++calls === 1 ? { Id: id, owner: true } : current,
      check: (_type, r) => { if (!r.owner) throw Error('ownership'); },
      docker: () => { removed = true; },
    }, 'container', 'name'), /ownership/);
    assert.equal(removed, false);
  }
});
test('cleanup removes valid IDs for every supported type and verifies absence', () => {
  for (const type of ['container', 'network', 'image']) {
    for (const remains of [false, true]) {
      const id = type === 'image' ? `sha256:${'a'.repeat(64)}` : 'a'.repeat(64);
      const calls = []; let removed = false;
      const operation = () => harness.cleanupResource({
        inspect: (_type, target) => { calls.push(target); return removed && !remains ? null : { Id: id }; },
        check: () => {},
        docker: args => { assert.deepEqual(args, type === 'container' ? ['container', 'rm', '--force', id] : [type, 'rm', id]); removed = true; },
      }, type, 'name');
      if (remains) assert.throws(operation, /cleanup/); else operation();
      assert.deepEqual(calls, remains ? ['name', id, id] : ['name', id, id, 'name']);
    }
  }
  harness.cleanupResource({ inspect: () => null, check: () => assert.fail('absent'), docker: () => assert.fail('absent') }, 'container', 'name');
});

test('pg client resolves the default namespace of a mocked CommonJS module', async () => {
  const cjs = new Module('in-memory-pg');
  cjs._compile("module.exports = { Client: require('node:events').EventEmitter };", 'in-memory-pg.cjs');
  const namespace = { default: cjs.exports };
  assert.equal(namespace.Client, undefined);
  assert.equal(await harness.loadPgClient(async () => namespace), cjs.exports.Client);
  const serialized = harness.serializeRunnerResult(await harness.runnerBoundary(async step => {
    step('pg-import');
    const Client = await harness.loadPgClient(async () => namespace);
    assert.ok(new Client() instanceof cjs.exports.Client);
    step('close');
  }));
  assert.equal(harness.parseRunnerResult(serialized).ok, true);
});

test('serialized runner boundary validates finite envelopes and rejects contaminated output', async () => {
  const sentinel = 'postgresql://private';
  const result = await harness.runnerBoundary(async step => { step('pg-import'); throw new TypeError(sentinel); });
  const output = harness.serializeRunnerResult(result);
  assert.deepEqual(harness.parseRunnerResult(output), { ok: false, step: 'pg-import', category: 'TypeError' });
  for (const text of [output + output, sentinel + output, output + sentinel, output.replace('TypeError', sentinel), output.replace('pg-import', 'arbitrary'), output.replace('false', 'true'), output.replace('}', ',"extra":1}'), 'x'.repeat(513)]) assert.equal(harness.parseRunnerResult(text), null);
  const diagnostic = await runOwned({ prepare: async () => {}, provision: async () => {}, verify: async () => { throw harness.dockerFailure({ status: 1, stdout: output, stderr: sentinel }, 'start'); }, cleanup: async () => { throw Error(sentinel); } });
  assert.deepEqual(diagnostic.diagnostic.runner, result);
  assert.equal(diagnostic.cleanup, 'failed');
  assert.ok(!JSON.stringify(diagnostic).includes(sentinel));
  for (const [step, error, category] of [['connect-primary', Object.assign(Error(sentinel), { code: '28P01' }), 'pg-sql'], ['close', Error(sentinel), 'unknown']]) {
    const envelope = await harness.runnerBoundary(async mark => { mark(step); throw error; });
    assert.deepEqual(harness.parseRunnerResult(harness.serializeRunnerResult(envelope)), { ok: false, step, category });
  }
  assert.equal((await harness.runnerBoundary(async () => {})).ok, false);
  assert.equal(harness.parseRunnerResult(output.replace('"ok":false', '"ok":false,"ok":false')), null);
  assert.equal(harness.parseRunnerResult(` ${output}`), null);
  const passed = await harness.runnerBoundary(async step => { step('close'); });
  assert.deepEqual(harness.parseRunnerResult(harness.serializeRunnerResult(passed)), { ok: true, step: 'passed', category: null });
  assert.equal(harness.parseRunnerResult(output.replace('false', 'true')), null);
  assert.equal((await runOwned({ prepare: async () => { throw harness.dockerFailure({ status: 1, stdout: output }, 'build'); }, cleanup: async () => {} })).diagnostic.runner, undefined);
});

const identity = { database: 'owned', role: 'owner', address: '172.20.0.2', port: 5432, system: '123', objects: 0 };
const checks = ['worker_daily_rate_positive', 'daily_pay_month_status_paid_at_consistency', 'worker_day_company_name_nonempty', 'worker_day_segment_position_range', 'worker_day_segment_share_range', 'worker_day_segment_kilometers_nonnegative'];
const catalog = { constraints: checks.map(name => ({ name, type: 'c', validated: true, definition: name })), indexes: ['index'], enums: ['enum'], tables: ['table'] };
const ledger = [{ migration_name: '20261005190000_baseline', checksum: 'hash', finished: true, rolled_back: false, applied_steps_count: 1 }];
function database(overrides = {}) {
  const calls = [];
  const deps = {
    proof: async key => { calls.push(`proof:${key}`); return identity; },
    deploy: async () => calls.push('deploy'),
    reference: async () => calls.push('reference'),
    diff: async () => calls.push('diff'),
    catalog: async key => { calls.push(`catalog:${key}`); return structuredClone(catalog); },
    ledger: async () => ledger,
    ...overrides,
  };
  return { calls, deps };
}
test('both actual URL proofs precede all migration/reference writes', async () => {
  const { calls, deps } = database();
  await verifyDatabase(deps, identity, 'hash');
  assert.deepEqual(calls, ['proof:DATABASE_URL', 'proof:DIRECT_URL', 'deploy', 'diff', 'reference', 'catalog:target', 'catalog:reference']);
});
test('second URL mismatch prevents every write', async () => {
  const { calls, deps } = database({ proof: async key => { calls.push(key); return key === 'DIRECT_URL' ? { ...identity, system: 'foreign' } : identity; } });
  await assert.rejects(verifyDatabase(deps, identity, 'hash'), /identity/);
  assert.deepEqual(calls, ['DATABASE_URL', 'DIRECT_URL']);
});
test('identity rejects every changed field and nonempty database', () => {
  for (const field of Object.keys(identity)) assert.throws(() => assertIdentity({ ...identity, [field]: 'wrong' }, identity), /identity/);
  assert.throws(() => assertIdentity({ ...identity, objects: 1 }, { ...identity, objects: 1 }), /identity/);
});
test('catalog rejects expression drift, unvalidated/missing checks, indexes, enums and FKs', () => {
  assertCatalog(catalog, catalog);
  for (const mutate of [c => { c.constraints[0].definition = 'wrong'; }, c => { c.constraints[0].validated = false; }, c => c.constraints.pop(), c => c.indexes.push('extra'), c => c.enums.push('extra'), c => c.constraints.push({ type: 'f', name: 'extra' })]) {
    const drift = structuredClone(catalog); mutate(drift);
    assert.throws(() => assertCatalog(drift, catalog), /catalog/);
  }
});
test('ledger is baseline-only, checksum bound, completed and not rolled back', () => {
  assertLedger(ledger, 'hash');
  for (const rows of [[], [...ledger, ...ledger], [{ ...ledger[0], checksum: 'wrong' }], [{ ...ledger[0], migration_name: 'historical' }], [{ ...ledger[0], finished: false }], [{ ...ledger[0], rolled_back: true }]]) assert.throws(() => assertLedger(rows, 'hash'), /ledger/);
});
test('owned resource checks reject foreign labels, mounts, ports and external networks', () => {
  const resource = { labels: { 'edi.verification.owner': 'id' }, mounts: [], ports: [], internal: true };
  assertResource(resource, 'id');
  for (const change of [{ labels: {} }, { mounts: [{ Type: 'volume' }] }, { ports: ['5432'] }, { internal: false }]) assert.throws(() => assertResource({ ...resource, ...change }, 'id'), /ownership/);
});
test('finite copy allowlist contains only schema, migration and lock', () => {
  assert.deepEqual(FILES, ['schema.prisma', 'migrations/migration_lock.toml', 'migrations/20261005190000_baseline/migration.sql']);
});
test('in-memory orchestration cleans after success and after provisioning failures', async () => {
  for (const fail of [false, true]) {
    const calls = [], files = new Map([['foreign', 'preserved']]), resources = new Set(['foreign']);
    const io = { prepare: async () => { files.set('schema', 'bytes'); calls.push('prepare'); }, provision: async () => { resources.add('owned'); calls.push('provision'); if (fail) throw Error('private URL'); }, verify: async () => calls.push('verify'), cleanup: async () => { resources.delete('owned'); files.delete('schema'); calls.push('cleanup'); } };
    const result = await runOwned(io);
    assert.equal(result.ok, !fail); assert.deepEqual([...files], [['foreign', 'preserved']]); assert.deepEqual([...resources], ['foreign']);
    assert.equal(calls.at(-1), 'cleanup'); assert.ok(!JSON.stringify(result).includes('private URL'));
  }
});
test('cleanup failure preserves original failure and prevents successful delivery', async () => {
  const result = await runOwned({ prepare: async () => {}, provision: async () => { throw Error('secret'); }, verify: async () => {}, cleanup: async () => { throw Error('credential'); } });
  assert.deepEqual(result, { ok: false, failure: 'provision', cleanup: 'failed', diagnostic: { category: 'unknown' }, cleanupDiagnostic: { category: 'unknown' } });
});
test('failed first URL proof prevents second connection and all writes', async () => {
  const { calls, deps } = database({ proof: async () => { calls.push('proof'); throw Error('identity'); } });
  await assert.rejects(verifyDatabase(deps, identity, 'hash'), /identity/);
  assert.deepEqual(calls, ['proof']);
});
test('prepare failure still invokes cleanup and diagnostics remain finite and scrubbed', async () => {
  let cleaned = false;
  const result = await runOwned({ prepare: async () => { throw Error('postgresql://private credentials'); }, provision: async () => assert.fail('unreachable'), verify: async () => assert.fail('unreachable'), cleanup: async () => { cleaned = true; } });
  assert.equal(cleaned, true);
  assert.deepEqual(result, { ok: false, failure: 'prepare', cleanup: 'passed', diagnostic: { category: 'unknown' }, cleanupDiagnostic: null });
});
test('successful verification cannot mask failed cleanup', async () => {
  const result = await runOwned({ prepare: async () => {}, provision: async () => {}, verify: async () => {}, cleanup: async () => { throw Error('cleanup'); } });
  assert.deepEqual(result, { ok: false, failure: null, cleanup: 'failed', diagnostic: null, cleanupDiagnostic: { category: 'unknown' } });
});
test('native Docker diagnostics serialize metadata only and preserve main versus cleanup', async () => {
  const sentinel = 'arbitrary private URL/path/name/credential';
  const native = { status: 1, signal: 'SIGTERM', error: { code: 'ETIMEDOUT', message: sentinel, path: sentinel }, stdout: sentinel, stderr: sentinel };
  const result = await runOwned({
    prepare: async () => { throw harness.dockerFailure(native, 'build', 'build'); },
    cleanup: async () => { throw harness.dockerFailure({ ...native, status: null, signal: sentinel, error: { code: sentinel } }, sentinel, sentinel); },
  });
  assert.deepEqual(result.diagnostic, { category: 'docker', operation: 'build', prepStep: 'build', status: 1, signal: 'SIGTERM', errorCode: 'ETIMEDOUT', stdoutBytes: Buffer.byteLength(sentinel), stderrBytes: Buffer.byteLength(sentinel) });
  assert.deepEqual(result.cleanupDiagnostic, { category: 'docker', operation: null, prepStep: null, status: null, signal: null, errorCode: null, stdoutBytes: Buffer.byteLength(sentinel), stderrBytes: Buffer.byteLength(sentinel) });
  assert.equal(result.failure, 'prepare'); assert.equal(result.cleanup, 'failed');
  assert.ok(!JSON.stringify(result).includes(sentinel));
  for (const category of ['ledger', 'ownership']) {
    const failure = await runOwned({ prepare: async () => {
      if (category === 'ledger') harness.assertLedger([], 'private');
      else harness.assertResource({}, 'private');
    }, cleanup: async () => {} });
    assert.deepEqual(failure.diagnostic, { category });
  }
});
test('successful orchestration has null diagnostics', async () => {
  assert.deepEqual(await runOwned({ prepare: async () => {}, provision: async () => {}, verify: async () => {}, cleanup: async () => {} }),
    { ok: true, failure: null, cleanup: 'passed', diagnostic: null, cleanupDiagnostic: null });
});
test('diff/catalog failures remain failures with cleanup', async () => {
  const { deps } = database({ diff: async () => { throw Error('diff'); } });
  await assert.rejects(verifyDatabase(deps, identity, 'hash'), /diff/);
  const result = await runOwned({ prepare: async () => {}, provision: async () => {}, verify: async () => { throw Error('catalog'); }, cleanup: async () => {} });
  assert.deepEqual(result, { ok: false, failure: 'verify', cleanup: 'passed', diagnostic: { category: 'unknown' }, cleanupDiagnostic: null });
});
