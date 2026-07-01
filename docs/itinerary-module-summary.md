# Itinerary Module - Summary

## Purpose

The `itinerary` module manages service routes (`routes` table), their stops (`route_stops`), and their pricing (`rates`). It replaces the legacy `recorrido`/`parada`/`tarifa` modules that were never finished.

## Architecture

```
itineraries (routes + stops + rates)  ──>  trips (calendar)  ──>  summaries (billing)
     ↑ new module                            ↑ already active       ↑ already active
```

- **Itinerary**: defines a named route belonging to a client, with ordered stops (address + optional GPS coordinates) and per-trip-type rates (base_price, surcharge_price).
- **Trips**: each recorded trip references a `route_id` and a `rate_id` to calculate `final_price`.
- **Summaries**: aggregate trips by billing period, summing `final_price` into `total_amount`.

## Key Features

1. **CRUD for itineraries** with role-based authorization (same as clients/trips: `getClientAccessLevel`).
2. **Stops (paradas)** nested under each itinerary — ordered stops with GPS coordinates for future geolocation features.
3. **Rates (tarifas)** nested under each itinerary — one rate per `trip_type` (`ida`, `ida_y_vuelta`, `especial`). This is the "monto" (price) assigned to each route.
4. **GPS Matching** (`POST /itineraries/match`): given a set of GPS points from a completed trip and a `client_id`, uses Haversine distance to find which of the client's itineraries best matches the actual route taken, returning the suggested itinerary and its rate.
5. **Trip lifecycle** (extended in `trips` module): driver can mark trip start, ad-hoc stops, and trip end — each recording GPS coordinates and timestamps.

## Database Changes

| Table | New fields | Purpose |
|-------|-----------|---------|
| `route_stops` | `lat`, `lng` (Decimal) | GPS coordinates for predefined stops |
| `trips` | `started_at`, `ended_at`, `start_lat`, `start_lng`, `end_lat`, `end_lng` | Actual trip timing and GPS trail |
| `trip_stops` (NEW) | `id`, `trip_id`, `lat`, `lng`, `stopped_at` | Ad-hoc stops marked by driver during trip |

## Endpoints

### Itineraries

| Method | Path | Description |
|--------|------|-------------|
| GET | `/itineraries` | List all (filtered by role) |
| POST | `/itineraries` | Create (name, client_id) |
| GET | `/itineraries/:id` | Detail with stops + rates |
| PATCH | `/itineraries/:id` | Update name |
| DELETE | `/itineraries/:id` | Delete (if no trips associated) |
| POST | `/itineraries/match` | Match GPS points to best itinerary |

### Stops (nested)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/itineraries/:id/stops` | List stops ordered by stop_order |
| POST | `/itineraries/:id/stops` | Add stop |
| PATCH | `/itineraries/:id/stops/:stopId` | Update stop |
| DELETE | `/itineraries/:id/stops/:stopId` | Remove stop |

### Rates (nested)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/itineraries/:id/rates` | List rates |
| POST | `/itineraries/:id/rates` | Set rate (base_price + trip_type) |
| PATCH | `/itineraries/:id/rates/:rateId` | Update rate |
| DELETE | `/itineraries/:id/rates/:rateId` | Remove rate |

### Trip lifecycle (extended in `trips`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/trips/:id/start` | Driver starts trip → records GPS + timestamp |
| POST | `/trips/:id/stops` | Driver marks ad-hoc stop → records GPS + timestamp |
| POST | `/trips/:id/end` | Driver ends trip → records GPS + timestamp |

## Cleanup

Deleted legacy modules and files:

- `src/modules/recorrido/` (4 files)
- `src/modules/parada/` (4 files)
- `src/modules/viaje/` (4 files)
- `src/modules/tarifa/` (empty)
- `src/utils/crud.ts` (no consumers after cleanup)
- `src/types/api.ts` (zero consumers)
