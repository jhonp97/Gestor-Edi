// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn(), render: vi.fn() }))
vi.mock('@/lib/session', () => ({ getSessionUniversal: mocks.session }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/fleet-global-report', async original => ({ ...await original<object>(), loadFleetGlobalReport: mocks.load }))
vi.mock('@/lib/pdf/fleet-global-document', () => ({ FleetGlobalDocument: () => null }))
vi.mock('@react-pdf/renderer', () => ({ renderToBuffer: mocks.render }))
import { GET } from '@/app/api/trucks/report/global/pdf/route'
import { InvalidGlobalFleetSelectionError, GlobalFleetReportTooLargeError } from '@/lib/fleet-global-report'
import { FleetGlobalDocument } from '@/lib/pdf/fleet-global-document'
const request = (query = 'month=2026-03&period=month&truck=a&truck=b') => GET(new NextRequest(`http://localhost/api/trucks/report/global/pdf?${query}`))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { organizationId: 'org' } })
  mocks.load.mockResolvedValue({ month: '2026-03', trucks: [] })
  mocks.render.mockResolvedValue(Buffer.from('%PDF-test'))
})
it.each([null, { user: {} }])('denies absent tenant', async session => {
  mocks.session.mockResolvedValue(session)
  expect((await request()).status).toBe(401)
  expect(mocks.load).not.toHaveBeenCalled()
})
it.each(['', 'month=bad&truck=a', 'month=2026-13&truck=a', 'month=2026-03', 'month=2026-03&truck=', 'month=2026-03&truck=all', 'month=2026-03&truck=a&truck=a', 'month=2026-03&truck=a%0A', 'month=2026-03&month=2026-04&truck=a', 'month=2026-03&period=week&truck=a', 'month=2026-03&period=month&period=year&truck=a', `month=2026-03&${Array.from({ length: 101 }, (_, i) => `truck=t${i}`).join('&')}`])('rejects malformed selections before load %s', async query => {
  const response = await request(query)
  expect(response.status).toBe(400)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(mocks.load).not.toHaveBeenCalled()
  expect(mocks.render).not.toHaveBeenCalled()
})
it.each(['month', 'quarter', 'half-year', 'year'])('passes repeated selected trucks and %s without web cursors', async period => {
  const response = await request(`month=2026-03&period=${period}&truck=b&truck=a&segmentsCursor=bad`)
  expect(response.status).toBe(200)
  expect(mocks.load).toHaveBeenCalledWith('org', ['b', 'a'], '2026-03', period)
  expect(mocks.render.mock.calls[0][0].type).toBe(FleetGlobalDocument)
  expect(mocks.render.mock.calls[0][0].props.report).toEqual({ month: '2026-03', trucks: [] })
  expect(response.headers.get('content-type')).toBe('application/pdf')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('content-disposition')).toBe('attachment; filename="informe-global-camiones-2026-03.pdf"')
})
it.each([[new InvalidGlobalFleetSelectionError('private internal detail'), 404], [new GlobalFleetReportTooLargeError('private internal detail'), 413], [new Error('private internal detail'), 500]] as const)('returns safe error status without rendering', async (error, status) => {
  mocks.load.mockRejectedValue(error)
  const response = await request()
  expect(response.status).toBe(status)
  expect(await response.text()).not.toContain('private internal detail')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(mocks.render).not.toHaveBeenCalled()
})
