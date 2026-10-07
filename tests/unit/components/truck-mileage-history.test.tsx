import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TruckMileageHistory } from '@/components/trucks/truck-mileage-history'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

it('labels workday-derived mileage and only offers deletion for manual records', () => {
  render(<TruckMileageHistory truckId="truck-a" records={[
    { id: 'manual', date: new Date('2026-05-09T00:00:00Z'), km: 10, notes: 'Manual note', createdAt: new Date('2026-05-09T00:00:00Z'), sourceWorkerDaySegmentId: null },
    { id: 'derived', date: new Date('2026-05-10T00:00:00Z'), km: 42, notes: null, createdAt: new Date('2026-05-10T00:00:00Z'), sourceWorkerDaySegmentId: 'segment-a' },
  ]} />)

  expect(screen.getByText('Jornada operativa')).toBeInTheDocument()
  expect(screen.getByText('Manual note')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Eliminar registro' })).toHaveLength(1)
})
