import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
// Focused source policy for this workflow's two-space jobs and inline run commands,
// not a general YAML parser or a proof of shell/runtime behavior.
const jobs = [...workflow.matchAll(/^  ([\w-]+):\s*\r?\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/gm)];

for (const name of ['quality', 'test', 'build', 'audit']) {
  test(`${name} retains the tracked lockfile`, () => {
    const matches = jobs.filter(match => match[1] === name);
    assert.equal(matches.length, 1, `Expected one ${name} job`);
    // No direct lockfile manipulation is needed in these jobs. Fail closed on
    // any reference, including deletion, rename, or overwrite commands.
    assert.doesNotMatch(matches[0][2], /pnpm-lock\.yaml/, 'Do not manipulate the tracked lockfile');
  });

  test(`${name} requires frozen dependency installation`, () => {
    const matches = jobs.filter(match => match[1] === name);
    assert.equal(matches.length, 1, `Expected one ${name} job`);
    const commands = [...matches[0][2].matchAll(/^\s+run:\s*(.*)$/gm)].map(match => match[1].trim());
    const installs = commands.filter(command => /\bpnpm\s+install\b/.test(command));
    assert.ok(installs.length > 0, `Expected dependency installation in ${name}`);
    for (const command of installs) {
      assert.equal(command, 'pnpm install --frozen-lockfile', 'Every install must use the frozen lockfile');
    }
  });
}
