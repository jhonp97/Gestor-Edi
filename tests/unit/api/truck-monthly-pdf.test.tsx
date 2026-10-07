// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn(), render: vi.fn() }))
vi.mock('@/lib/session', () => ({ getSessionUniversal: mocks.session }))
vi.mock('@/lib/truck-monthly-export', async importOriginal => ({ ...await importOriginal<object>(), loadTruckMonthlyExport: mocks.load }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@react-pdf/renderer', () => ({ renderToBuffer: mocks.render, StyleSheet: { create: (s: unknown) => s } }))
import { GET } from '@/app/api/trucks/report/pdf/route'
import { InvalidFleetSelectionError } from '@/lib/truck-monthly-report'
import { ExportTooLargeError } from '@/lib/truck-monthly-export'
import { TruckMonthlyDocument } from '@/lib/pdf/truck-monthly-document'
const model = { month: '2026-03', trucks: [] }
const request = (query = 'month=2026-03&truck=all') => GET(new NextRequest(`http://localhost/api/trucks/report/pdf?${query}`))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { organizationId: 'org' } })
  mocks.load.mockResolvedValue(model)
  mocks.render.mockResolvedValue(Buffer.from('%PDF-synthetic'))
})
it.each([null, { user: {} }])('denies missing tenant before loading or rendering', async session => {
  mocks.session.mockResolvedValue(session)
  expect((await request()).status).toBe(401)
  expect(mocks.load).not.toHaveBeenCalled()
  expect(mocks.render).not.toHaveBeenCalled()
})
it.each(['month=bad', 'month=2026-13', 'month=2026-03&month=2026-04', 'month=2026-03&truck=a&truck=b', 'month=2026-03&truck=', 'month=2026-03&truck=a%0D%0A', 'month=2026-03&period=year', 'month=2026-03&period=month&period=month', 'truck=all'])('rejects invalid inputs %s before loading', async query => {
  expect((await request(query)).status).toBe(400)
  expect(mocks.load).not.toHaveBeenCalled()
  expect(mocks.render).not.toHaveBeenCalled()
})
it('deliberately ignores web cursors and supplies the complete safe model to PDF', async () => {
  const response = await request('month=2026-03&truck=a&period=month&transactionsCursor=invalid&segmentsCursor=x&segmentsCursor=y')
  expect(response.status).toBe(200)
  expect(mocks.load).toHaveBeenCalledWith('org', 'a', '2026-03')
  expect(mocks.render.mock.calls[0][0].type).toBe(TruckMonthlyDocument)
  expect(mocks.render.mock.calls[0][0].props.report).toEqual(model)
  expect(response.headers.get('content-type')).toBe('application/pdf')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('content-disposition')).toBe('attachment; filename="informe-camiones-2026-03.pdf"')
})
it.each([[new InvalidFleetSelectionError('Truck not found'), 404], [new ExportTooLargeError(), 413], [new Error('private internal detail'), 500]] as const)('maps safe errors without rendering or exposing internals', async (error, status) => {
  mocks.load.mockRejectedValue(error)
  const response = await request()
  expect(response.status).toBe(status)
  expect(await response.text()).not.toContain('private internal detail')
  expect(mocks.render).not.toHaveBeenCalled()
})
