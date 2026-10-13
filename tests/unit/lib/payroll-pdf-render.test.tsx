// @vitest-environment node
import { expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { NominaDocument } from '@/lib/pdf/nomina-document'

// Functional regression probe for the real renderer; no database or network fixtures.
it('renders a complete custom-period payroll as a real PDF', async () => {
  const buffer = await renderToBuffer(<NominaDocument payroll={{
    id: 'synthetic-payroll', month: 12, year: 2025,
    periodStart: '2025-12-15', periodEnd: '2026-01-14',
    baseSalary: 125.50, irpfPercent: 0, irpfAmount: 0,
    socialSecurityPercent: 0, socialSecurityAmount: 0, otherDeductions: 0,
    grossPay: 125.50, netPay: 125.50, paidAt: null,
    worker: { name: 'Synthetic Worker', dni: 'Synthetic', position: 'Driver' },
  }} />)
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  expect(buffer.length).toBeGreaterThan(1000)
  expect(buffer.toString('latin1')).toContain('%%EOF')
  expect(buffer.toString('latin1')).toContain('/Subtype /Image')
})
