# Proposal: Sistema de Kilometraje para Camiones

## Intent

Flota-EDI tracks financials (transactions) and personnel (workers) per truck, but has **NO mileage tracking**. Fleet managers need km monitoring per truck for maintenance scheduling, operational reporting, and cost analysis. This is a core fleet management gap.

## Scope

### In Scope
- New `MileageLog` Prisma model (date, km, notes, truckId, organizationId)
- API routes: CRUD + aggregation endpoints for mileage logs
- Register-mileage modal (`MileageLogDialog`) on truck detail page
- Mileage stats cards on truck detail: total km, current month km, current year km
- Monthly history: select month → see km for that month
- Yearly history: select year → see accumulated km, compare years
- Zod validation schema for mileage input
- Multi-tenant filtering via organizationId on every query

### Out of Scope
- Charts/graphs for mileage trends (future)
- Mileage alerts or maintenance thresholds (future)
- Bulk CSV import of mileage logs (future)
- Fuel efficiency calculation (km/L) (future)
- Dashboard-level mileage KPIs (future)

## Capabilities

### New Capabilities
- `truck-mileage`: Mileage logging, viewing, and aggregation per truck with monthly/yearly breakdowns

### Modified Capabilities
- None at spec level (Truck model gains a `mileageLogs` relation but no behavioral change)

## Approach

1. **Prisma**: Add `MileageLog` model linked to `Truck` via `truckId` with `organizationId` for tenant isolation. Indexes on `[truckId, date]` and `[organizationId]`. Run `prisma migrate`.

2. **Zod**: Add `createMileageLogSchema` in `src/schemas/index.ts` — date as `z.coerce.date()`, km as `z.number().int().positive()`, notes as `z.string().max(500).optional()`.

3. **API**: Two new route files:
   - `src/app/api/trucks/[id]/mileage/route.ts` — POST (create log), GET (list with ?month=&year= filters)
   - `src/app/api/trucks/[id]/mileage/stats/route.ts` — GET (total, monthly, yearly aggregations via `prisma.aggregate`)

4. **UI**: Three new components in `src/components/trucks/`:
   - `MileageLogDialog.tsx` — Dialog + form with `useState`, follows `TruckEditDialog` pattern
   - `MileageStats.tsx` — Server component with 3 stat cards (total, month, year)
   - `MileageHistory.tsx` — Monthly/yearly selector + table, computed in-memory from Prisma results

5. **Integration**: Add mileage section to `trucks/[id]/page.tsx` between stats and workers. "Registrar Kilometraje" button opens `MileageLogDialog`.

6. **Dates**: Native `input type="date"` with `new Date().toISOString().split('T')[0]` default — consistent with project patterns. No external date library.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Add `MileageLog` model |
| `src/schemas/index.ts` | Modified | Add `createMileageLogSchema` |
| `src/app/api/trucks/[id]/mileage/` | New | POST + GET mileage logs |
| `src/app/api/trucks/[id]/mileage/stats/` | New | GET aggregated stats |
| `src/components/trucks/mileage-log-dialog.tsx` | New | Add-mileage modal |
| `src/components/trucks/mileage-stats.tsx` | New | Stats cards component |
| `src/components/trucks/mileage-history.tsx` | New | Monthly/yearly history |
| `src/app/(app)/trucks/[id]/page.tsx` | Modified | Integrate mileage section |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicate date entries for same truck | Med | Unique constraint `@@unique([truckId, date])` prevents double-entry |
| Large mileage history causes slow page load | Low | Pagination on GET endpoint + aggregate queries for stats |
| Users enters km instead of cumulative total | Med | UI clarifies "kilómetros del día", store daily delta not cumulative |

## Rollback Plan

1. Remove mileage routes, components, and schema entries
2. Run `prisma migrate reset` or write a down-migration dropping `MileageLog` table
3. Revert `page.tsx` to remove mileage section

## Dependencies

- Prisma migration on Supabase PostgreSQL (production coordinate needed)

## Success Criteria

- [ ] User can register daily km from truck detail via modal (date, km, optional notes)
- [ ] Truck detail shows total km, current month km, current year km
- [ ] User can select any month and see km for that month
- [ ] User can select any year and see accumulated km, compare across years
- [ ] All queries scoped to user's organizationId
- [ ] Zod validation rejects negative/zero km values
- [ ] No date-fns or external date library added