// @vitest-environment node
import { ESLint } from 'eslint'
import { expect, it } from 'vitest'

it('excludes local worktrees and generated coverage without excluding application code', async () => {
  const eslint = new ESLint()
  const paths = ['.pi/worktrees/example/src/example.ts', 'coverage/block-navigation.js', '.next/server/example.js', 'src/lib/fleet-global-report.ts', 'tests/unit/lib/fleet-global-report.test.ts']
  expect(await Promise.all(paths.map(path => eslint.isPathIgnored(path)))).toEqual([true, true, true, false, false])
  const config = await eslint.calculateConfigForFile('src/lib/fleet-global-report.ts')
  expect(config?.rules?.['@typescript-eslint/no-explicit-any']?.[0]).toBe(2)
}, 15000)
