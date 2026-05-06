# Truck Mileage Specification

## Purpose

Mileage logging, viewing, and aggregation per truck with monthly/yearly breakdowns. Multi-tenant scoped via organizationId.

## Requirements

### FR-001: Register daily km (Must)

The system SHALL allow authenticated users to register km for a specific truck on a given date.

- GIVEN authenticated user with truck "ABC-123" in their organization
- WHEN they submit `{ date: "2025-05-06", km: 150 }` to POST /api/trucks/{id}/mileage
- THEN the system creates the record and returns 201 with `{ id, truckId, date, km, notes, createdAt }`

### FR-002: Prevent duplicate date entries (Must)

The system MUST reject a second mileage entry for the same truck on the same date.

- GIVEN truck "ABC-123" already has 150 km on 2025-05-06
- WHEN user submits another entry for the same truck and date
- THEN the system returns 409 with `{ error: "Ya existe un registro de kilometraje para esta fecha" }`

### FR-003: View total historical km (Must)

The system SHALL display total accumulated km for a truck across all time.

- GIVEN truck "ABC-123" has records: 150 + 300 + 200 = 650 km
- WHEN user views truck detail
- THEN total km displays as 650

### FR-004: View monthly km total (Must)

The system SHALL display km total for the current month per truck.

- GIVEN truck has 3 records in May 2025 summing 1500 km
- WHEN user views truck detail
- THEN monthly km shows 1500

### FR-005: View yearly km total (Must)

The system SHALL display km total for the current year per truck.

- GIVEN truck has records across 2025 summing 18450 km
- WHEN user views truck detail
- THEN yearly km shows 18450

### FR-006: Query yearly history (Should)

The system SHALL allow selecting a year and viewing accumulated km per month.

- GIVEN truck "ABC-123" has records in 2024 and 2025
- WHEN user selects year 2025 in history
- THEN they see "2025: 18,450 km" monthly breakdown

### FR-007: Query monthly history (Should)

The system SHALL allow selecting a month and viewing daily km records.

- GIVEN truck has 5 records in May 2025
- WHEN user selects month=5, year=2025
- THEN they see those 5 records with dates and km

### FR-008: Delete a mileage record (Could)

The system SHALL allow deleting a mileage record by its ID with org-scoped verification.

- GIVEN user owns org with mileage record id "m1"
- WHEN DELETE /api/trucks/{id}/mileage/{mileageId} is called
- THEN record is deleted, response 204

### NFR-001: Multi-tenant isolation (Must)

ALL mileage queries MUST filter by the authenticated user's organizationId. Cross-org data MUST NOT be visible.

- GIVEN user from Org A requests mileage for Org B truck
- WHEN they call any mileage endpoint
- THEN they receive 404 or empty result

### NFR-002: Aggregation performance (Should)

Stats aggregations (total, monthly, yearly) SHOULD complete under 200ms for up to 10,000 records per truck.

- GIVEN truck with 10,000 mileage records
- WHEN GET /api/trucks/{id}/mileage/stats is called
- THEN response arrives within 200ms

### NFR-003: Responsive input (Must)

The mileage form MUST use native `input type="date"` — no external date library. MUST work on mobile and desktop.

- GIVEN user on any device
- WHEN they interact with the mileage form
- THEN native date picker renders correctly without JavaScript date libraries

### Scenario: PLATFORM_ADMIN access

- GIVEN user with role PLATFORM_ADMIN
- WHEN they access mileage for any truck
- THEN they can view km data across organizations
- AND DNI of workers remains masked per existing rules

## API Contract

### POST /api/trucks/{id}/mileage

- **Body**: `{ date: "2025-05-06", km: 150, notes?: "Viaje a Barcelona" }`
- **201**: `{ id, truckId, date, km, notes, createdAt }`
- **400**: `{ error: "Datos inválidos" }`
- **403**: `{ error: "El camión no pertenece a tu organización" }`
- **409**: `{ error: "Ya existe un registro para esta fecha" }`

### GET /api/trucks/{id}/mileage?year=2025&month=5

- **200**: `{ records: [{ id, date, km, notes }], monthlyTotal: 1500, yearlyTotal: 18450 }`

### GET /api/trucks/{id}/mileage/stats

- **200**: `{ totalKm: 22000, monthlyKm: 1500, yearlyKm: 18450 }`

### DELETE /api/trucks/{id}/mileage/{mileageId}

- **204**: No content
- **404**: Not found or wrong org

## Data Model

```prisma
model TruckMileage {
  id             String   @id @default(uuid())
  truckId        String
  truck          Truck    @relation(fields: [truckId], references: [id], onDelete: Cascade)
  date           DateTime @db.Date
  km             Float
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@unique([truckId, date])
  @@index([truckId])
  @@index([date])
  @@index([organizationId])
}
```

Truck model gains: `mileageLogs TruckMileage[]`
Organization model gains: `mileageLogs TruckMileage[]`