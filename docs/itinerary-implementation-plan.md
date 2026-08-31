# Itinerary Module - Implementation Plan

## Step-by-step execution order

---

### Step 1: Clean legacy modules

Delete unused files:

```powershell
Remove-Item -Recurse -Force "src\modules\recorrido"
Remove-Item -Recurse -Force "src\modules\parada"
Remove-Item -Recurse -Force "src\modules\viaje"
Remove-Item -Recurse -Force "src\modules\tarifa"
Remove-Item -Force "src\utils\crud.ts"
Remove-Item -Force "src\types\api.ts"
```

---

### Step 2: Database schema migration

Edit `prisma/schema.prisma`:

Add to `route_stops`:
```prisma
lat  Decimal?  @db.Decimal(10,7)
lng  Decimal?  @db.Decimal(10,7)
```

Add to `trips`:
```prisma
started_at  DateTime?  @db.Timestamptz(6)
ended_at    DateTime?  @db.Timestamptz(6)
start_lat   Decimal?   @db.Decimal(10,7)
start_lng   Decimal?   @db.Decimal(10,7)
end_lat     Decimal?   @db.Decimal(10,7)
end_lng     Decimal?   @db.Decimal(10,7)
trip_stops  trip_stops[]
```

New model `trip_stops`:
```prisma
model trip_stops {
  id         BigInt    @id @default(autoincrement())
  trip_id    BigInt
  lat        Decimal   @db.Decimal(10,7)
  lng        Decimal   @db.Decimal(10,7)
  stopped_at DateTime  @default(now()) @db.Timestamptz(6)
  trips      trips     @relation(fields: [trip_id], references: [id], onDelete: Cascade)
}
```

Run migration:
```powershell
npx prisma migrate dev --name add_trip_gps_and_stops
```

---

### Step 3: Create `src/modules/itinerary/`

Create 4 files:

#### `types.ts`
DTOs for itinerary, stop, rate, and match operations.

#### `service.ts`
- Custom service (NOT using `crud.ts`), following same patterns as `clients/service.ts` and `trips/service.ts`.
- Uses `prisma.routes`, `prisma.route_stops`, `prisma.rates`.
- Authorization via `getClientAccessLevel` from `calendarAuth.ts`.
- `matchItinerary()`: Haversine distance calculation to find best itinerary from GPS points.

#### `controller.ts`
- Request handlers following the `trips/controller.ts` pattern.
- Try/catch per handler → `res.json({ success, data })`.

#### `routes.ts`
- Express Router with `verifyToken` middleware.
- 16 endpoints (itineraries + stops + rates + match).

---

### Step 4: Extend trips module

Modify `src/modules/trips/service.ts`:

1. **Fix `findOrCreateRateForTrip`**: add `route_id` parameter, filter by it in rate lookup.
2. **Add `startTrip(id, lat, lng, user?)`**: updates `started_at`, `start_lat`, `start_lng`.
3. **Add `addStop(id, lat, lng, user?)`**: inserts into `trip_stops`.
4. **Add `endTrip(id, lat, lng, user?)`**: updates `ended_at`, `end_lat`, `end_lng`.

Modify `src/modules/trips/controller.ts`: add `startTrip`, `addStop`, `endTrip` handlers.

Modify `src/modules/trips/routes.ts`: add 3 new endpoints.

---

### Step 5: Register routes

Edit `src/routes/index.ts`:

```typescript
import itineraryRoutes from '../modules/itinerary/routes'
router.use('/itineraries', itineraryRoutes)
```

---

### Step 6: Update Swagger docs

Edit `src/docs/swagger.ts`:

- Add schemas: `CreateItineraryDTO`, `UpdateItineraryDTO`, `CreateStopDTO`, `UpdateStopDTO`, `CreateRateDTO`, `UpdateRateDTO`, `MatchRequestDTO`, `StartTripDTO`, `StopTripDTO`, `EndTripDTO`.
- Add paths under `tags: ['Itineraries']`: 16 endpoints.
- Add paths under `tags: ['Trips']`: `/{id}/start`, `/{id}/stops`, `/{id}/end`.

---

### Step 7: Write tests

#### `tests/unit/modules/itinerary/service.test.ts`
- Mock `prisma` (routes, route_stops, rates, clients).
- Mock `calendarAuth`.
- Test all service functions: getAll, getById, create, update, remove, getStops, createStop, updateStop, removeStop, getRates, createRate, updateRate, removeRate, matchItinerary.
- Pattern: same as `tests/unit/modules/trips/service.test.ts`.

#### Extend `tests/unit/modules/trips/service.test.ts`
- Update `findOrCreateRateForTrip` test to verify `route_id` filtering.
- Add tests for `startTrip`, `addStop`, `endTrip`.

---

### Step 8: Verify

```powershell
npm test
npx prisma generate
npm run build --if-present
```

---

## Files affected summary

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Edit: add fields + new model |
| `src/modules/itinerary/types.ts` | Create |
| `src/modules/itinerary/service.ts` | Create |
| `src/modules/itinerary/controller.ts` | Create |
| `src/modules/itinerary/routes.ts` | Create |
| `src/modules/trips/types.ts` | No change (reuse existing) |
| `src/modules/trips/service.ts` | Edit: fix + 3 new functions |
| `src/modules/trips/controller.ts` | Edit: 3 new handlers |
| `src/modules/trips/routes.ts` | Edit: 3 new routes |
| `src/routes/index.ts` | Edit: 1 line |
| `src/docs/swagger.ts` | Edit: schemas + paths |
| `tests/unit/modules/itinerary/service.test.ts` | Create |
| `tests/unit/modules/trips/service.test.ts` | Edit: update + extend |
| `src/modules/recorrido/` | Delete |
| `src/modules/parada/` | Delete |
| `src/modules/viaje/` | Delete |
| `src/modules/tarifa/` | Delete |
| `src/utils/crud.ts` | Delete |
| `src/types/api.ts` | Delete |
