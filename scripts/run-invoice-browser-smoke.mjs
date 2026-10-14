import { mkdir, writeFile, readFile, copyFile, access } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

// Build a disposable, synthetic-auth app inside this checkout. Never copy .env,
// middleware or database configuration, and never alter production auth modules.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const harness = join(root, '.pi', 'invoice-browser-harness')
const require = createRequire(import.meta.url)
const next = require.resolve('next/dist/bin/next')
const playwright = require.resolve('@playwright/test/cli')
const diagnoseOrigin = process.argv.includes('--diagnose-origin')
const port = 3118
const baseURL = `http://127.0.0.1:${port}`
async function put(relative, text) {
  const path = join(harness, relative)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text)
}
async function ensureFreshPort() {
  try {
    await fetch(baseURL, { signal: AbortSignal.timeout(1500) })
  } catch { return }
  throw new Error('Refusing to reuse an existing server on the smoke-test port')
}
await ensureFreshPort()
await mkdir(harness, { recursive: true })
await put('package.json', JSON.stringify({ name: 'isolated-invoice-browser-smoke', private: true }))
await put('next.config.mjs', 'export default { poweredByHeader: false }\n')
await put('postcss.config.mjs', await readFile(join(root, 'postcss.config.mjs'), 'utf8'))
await put('tsconfig.json', JSON.stringify({ compilerOptions: {
  target: 'ES2017', lib: ['dom', 'dom.iterable', 'esnext'], strict: true,
  noEmit: true, esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler',
  resolveJsonModule: true, isolatedModules: true, jsx: 'react-jsx', skipLibCheck: true,
  plugins: [{ name: 'next' }], paths: {
    '@/lib/session': ['./src/test-session.ts'],
    '@/lib/auth-edge': ['./src/test-auth-edge.ts'],
    '@/*': ['../../src/*'],
  },
}, include: ['src/**/*.ts', 'src/**/*.tsx', '.next/types/**/*.ts'] }, null, 2))
await put('src/test-session.ts', `import { headers } from 'next/headers'
export async function getSessionUniversal() {
  const requestHeaders = await headers()
  if (requestHeaders.get('x-invoice-test-anonymous') === '1') return null
  return { user: { id: 'invoice-test', organizationId: 'invoice-org', name: 'Prueba', role: 'USER' } }
}\n`)
await put('src/test-auth-edge.ts', `export async function getUserFromRequest(request: Request) {
  if (request.headers.get('x-invoice-test-anonymous') === '1') return null
  return { userId: 'invoice-test', organizationId: 'invoice-org', email: 'synthetic@example.invalid', role: 'USER' }
}\n`)
await put('src/app/layout.tsx', `import './globals.css'
import { MainLayout } from '@/components/layout/main-layout'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body style={{ fontFamily: \"system-ui, sans-serif\" }}><MainLayout>{children}</MainLayout></body></html>
}\n`)
await put('src/app/globals.css', (await readFile(join(root, 'src/app/globals.css'), 'utf8')) + `\n@source "../../../../src";\n`)
await put('src/app/facturas/page.tsx', `export { default } from '@/app/(app)/facturas/page'\n`)
await put('src/app/api/invoices/pdf/route.ts', `import { POST as productionPost } from '@/app/api/invoices/pdf/route'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  console.log('Invoice origin metadata', JSON.stringify({
    requestOrigin: new URL(request.url).origin,
    browserOrigin: request.headers.get('origin'),
    site: request.headers.get('sec-fetch-site'),
    host: request.headers.get('host'),
  }))
  return productionPost(request)
}\n`)
await put('src/app/api/auth/session/route.ts', `export async function GET() {
  return Response.json({ user: { id: 'invoice-test', name: 'Prueba', role: 'USER' } })
}\n`)
await put('src/app/login/page.tsx', 'export default function Login() { return <h1>Inicio de sesión de prueba</h1> }\n')
await mkdir(join(harness, 'public/branding'), { recursive: true })
await copyFile(join(root, 'public/branding/transportes-acevedo-hernandez.png'), join(harness, 'public/branding/transportes-acevedo-hernandez.png'))
await put('playwright.config.mjs', `import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: ${JSON.stringify(join(root, 'tests/e2e'))},
  testMatch: 'invoices.spec.ts', timeout: 120000, retries: 0, workers: 1,
  reporter: 'list', outputDir: ${JSON.stringify(join(harness, 'test-results'))},
  use: { baseURL: ${JSON.stringify(baseURL)}, actionTimeout: 15000, navigationTimeout: 45000, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})\n`)
const server = spawn(process.execPath, [next, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: harness, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
server.stdout.on('data', data => { log += data.toString() })
server.stderr.on('data', data => { log += data.toString() })
try {
  const deadline = Date.now() + 150000
  let ready = false
  while (!ready && Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Synthetic test server exited before readiness')
    try { ready = (await fetch(`${baseURL}/api/auth/session`, { signal: AbortSignal.timeout(5000) })).ok } catch {}
    if (!ready) await new Promise(done => setTimeout(done, 500))
  }
  if (!ready) throw new Error('Synthetic test server did not become ready within 150 seconds')
  console.log('Isolated invoice server ready; production page/editor/PDF code, synthetic auth, no database')
  const anonymous = await fetch(`${baseURL}/api/invoices/pdf`, {
    method: 'POST', headers: { 'x-invoice-test-anonymous': '1', 'content-type': 'application/json' }, body: '{}',
    signal: AbortSignal.timeout(60000),
  })
  if (anonymous.status !== 401) throw new Error(`Anonymous PDF warm-up expected401, got${anonymous.status}`)
  console.log('Actual PDF route compiled; synthetic anonymous request rejected401')
  if (diagnoseOrigin) {
    const probe = await fetch(`${baseURL}/api/invoices/pdf`, {
      method: 'POST', headers: { origin: baseURL, 'content-type': 'application/json' }, body: '{}',
      signal: AbortSignal.timeout(15000),
    })
    console.log(`Origin diagnostic HTTP status:${probe.status} (400 means origin passed;403 means origin rejected)`)
    console.log(log.split('\n').filter(line => line.includes('Invoice origin metadata')).join('\n'))
  } else {
    const child = spawn(process.execPath, [playwright, 'test', '--config', join(harness, 'playwright.config.mjs')], { cwd: root, stdio: 'inherit' })
    const code = await new Promise((done, reject) => { child.on('error', reject); child.on('exit', done) })
    process.exitCode = code ?? 1
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Browser smoke failed')
  process.exitCode = 1
} finally {
  server.kill()
  await writeFile(join(harness, 'server.log'), log)
  await access(join(harness, 'server.log'))
  console.log('Synthetic server stopped; artifacts are inside .pi/invoice-browser-harness')
}
