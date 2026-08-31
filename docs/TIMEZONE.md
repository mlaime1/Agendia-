# Uso de Zonas Horarias en Agendia

## 1. Filosofía General

> **Almacenar en UTC, mostrar en local.**

Toda la base de datos y el backend operan en **UTC** de forma consistente. El único contexto de zona horaria lo aporta el campo `clients.timezone`, que se utiliza para convertir fechas/horas al momento de presentarlas al usuario o calcular límites de períodos que dependen del "día local" del cliente.

---

## 2. Tipos de Datos en PostgreSQL

| Campo | Modelo | Tipo DB | ¿Zona Horaria? | Uso |
|-------|--------|---------|----------------|-----|
| `created_at`, `updated_at` | casi todos | `Timestamptz(6)` | ✅ Sí | Auditoría. Siempre UTC. |
| `trip_date` | `trips` | `Timestamptz(6)` | ✅ Sí | Fecha del viaje. Migrado de `Timestamp(6)` para consistencia. |
| `started_at`, `ended_at` | `trips` | `Timestamptz(6)` | ✅ Sí | Inicio/fin real del viaje. |
| `stopped_at` | `trip_stops` | `Timestamptz(6)` | ✅ Sí | Momento de la parada. |
| `expires_at`, `used_at` | `invitation_codes` | `Timestamptz(6)` | ✅ Sí | Expiración de invitaciones. |
| `sent_at`, `paid_at`, `archived_at` | `summaries` | `Timestamptz(6)` | ✅ Sí | Estados del resumen. |
| `pickup_time`, `return_time` | `service_schedules` | `Time(0)` | ❌ No | Hora de reloj del cliente (ej: 08:30). Se interpreta junto a `clients.timezone`. |
| `period_start`, `period_end` | `summaries` | `Date` | ❌ No | Fechas puras de facturación. Se calculan en UTC pero representan días locales. |
| `billing_start_date` | `clients` | `Date` | ❌ No | Inicio de facturación. |
| `start_date`, `end_date` | `rates` | `Date` | ❌ No | Vigencia de tarifas. |

### Decisiones clave

- **`Timestamptz(6)` para todo timestamp absoluto:** garantiza que el valor almacenado tenga un significado único en el mundo, independientemente de dónde corra el servidor.
- **`Time(0)` sin zona para horarios de servicio:** `pickup_time` y `return_time` son "horas de reloj" que se repiten semanalmente. No tienen zona horaria propia; su contexto es la zona horaria del cliente.
- **`Date` para fechas de facturación:** son días lógicos. El cálculo de sus límites (inicio/fin de día) se hace en UTC pero alineado a la zona horaria del cliente cuando sea necesario.

---

## 3. Backend (Node.js / Express)

### 3.1. Configuración del servidor

No se define una variable `TZ` global en el entorno, pero se asume que el servidor **debe estar en UTC** o, al menos, que todo el código utiliza métodos UTC (`getUTC*`, `setUTC*`, `Date.UTC`).

Si se despliega en un entorno no controlado, se recomienda forzar UTC al inicio de `server.ts`:

```typescript
process.env.TZ = 'UTC';
```

### 3.2. Timestamps de creación y actualización

Todos los timestamps se generan con `new Date()` (que produce UTC) o con `@default(now())` / `@updatedAt` de Prisma (también UTC):

```typescript
// Ejemplo en trips/service.ts
started_at: new Date(),
ended_at: new Date(),
```

### 3.3. Helpers de zona horaria (`src/utils/timezone.ts`)

El backend incluye helpers centralizados para convertir entre UTC y la zona horaria del cliente:

```typescript
import { toUTC, toClientTimeString, clientStartOfDay, clientEndOfDay, isValidIANA } from '../../utils/timezone'

// Convertir una fecha local del cliente a UTC
const utcDate = toUTC('2026-06-15', 'America/Argentina/Buenos_Aires')
// → 2026-06-15T03:00:00Z (UTC)

// Convertir UTC a string local del cliente
const localStr = toClientTimeString(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm')
// → "2026-06-15 00:00"

// Inicio/fin del día en la zona del cliente
const start = clientStartOfDay(new Date(), 'America/Argentina/Buenos_Aires')
const end   = clientEndOfDay(new Date(), 'America/Argentina/Buenos_Aires')
```

### 3.4. Horarios de servicio (`pickup_time` / `return_time`)

El frontend envía strings `"HH:mm"`. El backend los convierte a objetos `Date` usando **UTC** como referencia del día:

```typescript
// src/modules/schedules/service.ts
const timeStringToDate = (value: string): Date => {
  const [hh, mm] = value.split(':').map(Number)
  const d = new Date()
  d.setUTCHours(hh, mm, 0, 0)
  return d
}

const dateToTimeString = (value: Date | null): string | null => {
  if (!value) return null
  const hh = String(value.getUTCHours()).padStart(2, '0')
  const mm = String(value.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
```

**Importante:** al guardar en PostgreSQL como `TIME(0)`, la hora se almacena literalmente. Al leerla, Prisma devuelve un `Date` con una fecha arbitraria. El servicio normaliza la hora usando `getUTCHours()` para mantener consistencia.

> **Nota:** En una implementación futura, estos helpers deberían usar `clients.timezone` para construir la hora local del cliente y luego convertir a UTC, en lugar de asumir UTC directamente. Por ahora, el contrato es que el frontend envía `HH:mm` en la zona horaria del cliente y el backend los guarda tal cual (interpretando UTC como la referencia temporal).

### 3.4. Cálculo de períodos de facturación (UTC puro)

La lógica de facturación (semanal, quincenal, mensual) opera en UTC para evitar desplazamientos por zona horaria del servidor:

```typescript
// src/modules/summaries/billingPeriod.ts
const stripTime = (d: Date): Date => {
  const out = new Date(d)
  out.setUTCHours(0, 0, 0, 0)
  return out
}

const addDays = (d: Date, n: number): Date => {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + n)
  return out
}
```

En el futuro, si se requiere que el cierre de un período respete la medianoche del cliente, se debe usar `clients.timezone` para calcular el límite UTC correspondiente.

### 3.5. Scheduler automático (node-cron)

```typescript
// src/modules/summaries/scheduler.ts
cron.schedule('0 1 * * *', async () => {
  // Ejecuta todos los días a la 1:00 AM del servidor
  // Actualmente sin ajuste de zona horaria.
  // Futuro: iterar clientes y calcular "1:00 AM local de cada cliente".
})
```

---

## 4. Campo `clients.timezone`

### 4.1. Schema

```prisma
model clients {
  // ...
  timezone String @default("America/Argentina/Buenos_Aires") @db.VarChar
  // ...
}
```

### 4.2. Valores esperados

Se utilizan **identificadores IANA**, por ejemplo:
- `America/Argentina/Buenos_Aires`
- `Europe/Madrid`
- `America/New_York`
- `UTC`

### 4.3. Uso actual

- **Se almacena en la BD** al crear o actualizar un cliente.
- **Se valida como IANA** al momento de guardar (`isValidIANA`). Si se envía un valor inválido, el backend devuelve `400`.
- **Se usa para convertir `trip_date`** al crear o actualizar un viaje. El backend busca el `timezone` del cliente y convierte la fecha local del cliente a UTC antes de guardar.
- **Se expone en la API** como parte del objeto `client`.
- **Futuro:** se usará para `pickup_time`/`return_time`, cálculo de períodos de facturación, y scheduler de resúmenes.

### 4.4. Implementación de `trip_date`

Al crear o actualizar un viaje, el backend:

1. Busca el cliente para obtener su `timezone`.
2. Recibe `trip_date` como string `YYYY-MM-DD` desde el frontend.
3. Usa `toUTC(dateStr, timezone)` para convertir la fecha local del cliente a un `Date` UTC que representa las **00:00:00** de ese día en la zona del cliente.

```typescript
// src/modules/trips/service.ts
const client = await prisma.clients.findUnique({
  where: { id: client_id },
  select: { timezone: true },
})
const tripDate = toUTC(data.trip_date, client.timezone)
```

Esto garantiza que cuando el frontend pida "todos los viajes del 15 de junio", la comparación se haga correctamente sin importar en qué zona horaria esté el servidor.

---

## 5. Contrato con el Frontend

### 5.1. Envío de fechas al backend

| Campo | Formato esperado | ¿Qué significa? |
|-------|-----------------|----------------|
| `trip_date` | `YYYY-MM-DD` (string) | Fecha del día del viaje **en la zona horaria del cliente**. El backend la convierte a UTC usando `clients.timezone`. |
| `pickup_time` / `return_time` | `HH:mm` (string) | Hora de reloj en la zona horaria del cliente. El backend la guarda como `TIME(0)`. |
| `started_at`, `ended_at`, `stopped_at` | `ISO 8601` en UTC | Timestamps absolutos generados por el dispositivo o el backend. |
| `billing_start_date`, `period_start`, `period_end` | `YYYY-MM-DD` | Fechas puras sin hora. El backend las interpreta como inicio del día UTC. |

### 5.2. Recepción de fechas del backend

El backend siempre devuelve fechas en **UTC** (objetos `Date` serializados a ISO 8601). El frontend es responsable de convertirlas a la zona horaria local del cliente antes de mostrarlas.

```typescript
// Ejemplo frontend (React / Vue / Angular)
import { format, toZonedTime } from 'date-fns-tz'

function displayTripDate(utcDateString: string, clientTimezone: string) {
  const date = new Date(utcDateString)
  const zoned = toZonedTime(date, clientTimezone)
  return format(zoned, 'dd/MM/yyyy', { timeZone: clientTimezone })
}

function displayPickupTime(utcDateString: string, clientTimezone: string) {
  const date = new Date(utcDateString)
  const zoned = toZonedTime(date, clientTimezone)
  return format(zoned, 'HH:mm', { timeZone: clientTimezone })
}
```

### 5.3. Reglas de oro para el frontend

1. **Nunca enviar fechas/horas como string sin formato definido.** Siempre usar `YYYY-MM-DD` para días y `HH:mm` para horas de reloj.
2. **Nunca confiar en `new Date()` del navegador para fechas del cliente.** El navegador usa la zona horaria del dispositivo del usuario, que puede ser diferente a la del cliente (ej: un admin en España gestionando un cliente en Argentina).
3. **Siempre mostrar la zona horaria del cliente al lado de la hora.** Ej: "08:30 (ART)" o "08:30 - America/Argentina/Buenos_Aires".
4. **Para filtros de fecha en el frontend**, convertir el rango de fechas local del cliente a UTC antes de enviar al backend, o usar el helper `clientStartOfDay`/`clientEndOfDay` del backend.

---

## 6. Migración realizada

### Cambios en la base de datos

1. **`trips.trip_date`**: migrado de `Timestamp(6)` → `Timestamptz(6)` para alinearlo con el resto de timestamps y garantizar zona horaria absoluta.
2. **`clients.timezone`**: nuevo campo `String @default("America/Argentina/Buenos_Aires")` que permite asociar una zona horaria IANA a cada cliente. El default refleja la realidad de negocio: todos los clientes actuales son de Argentina.

### Archivos modificados

- `prisma/schema.prisma`
- `prisma/seed.ts` (seeds ahora incluyen `timezone: 'America/Argentina/Buenos_Aires'`)
- `src/modules/clients/types.ts` (`CreateClientDTO` / `UpdateClientDTO` incluyen `timezone`)
- `src/modules/clients/service.ts` (create/update aceptan, validan y persisten `timezone`)
- `src/modules/trips/service.ts` (create/update usan `toUTC` con `clients.timezone` para `trip_date`)
- `src/utils/timezone.ts` (nuevo: helpers de conversión con `date-fns-tz`)
- `package.json` (agregada dependencia `date-fns-tz`)

### Migración generada

```
prisma/migrations/20260612205931_add_timezone_and_trip_date_timestamptz/
```

---

## 6. Checklist para desarrolladores

### Backend
- [x] Siempre usar `new Date()` o métodos `UTC*` al crear/modificar timestamps en el backend.
- [x] Nunca confiar en la zona horaria del servidor para lógica de negocio.
- [x] Validar `clients.timezone` con `isValidIANA` antes de guardar.
- [x] Convertir `trip_date` de `YYYY-MM-DD` local del cliente a UTC usando `toUTC()` antes de persistir.
- [ ] Convertir `pickup_time`/`return_time` usando `clients.timezone` en lugar de asumir UTC (futuro).
- [ ] Usar `clients.timezone` en el scheduler de resúmenes para cerrar períodos a medianoche local (futuro).

### Frontend
- [x] Al mostrar fechas/horas, usar `clients.timezone` para convertir desde UTC.
- [x] Al enviar `trip_date`, usar formato `YYYY-MM-DD` en la zona horaria del cliente.
- [x] Al enviar `pickup_time`/`return_time`, usar formato `HH:mm` en la zona horaria del cliente.
- [x] Mostrar la zona horaria del cliente junto a las horas (ej: "08:30 ART").
- [ ] Nunca confiar en la zona horaria del dispositivo del usuario para fechas de un cliente diferente.

---

## 7. Resumen de responsabilidades

| Capa | Responsabilidad |
|------|----------------|
| **Base de Datos** | Guardar todo en UTC (`Timestamptz`) o como datos puros (`Date`, `Time`). |
| **Backend** | Validar `clients.timezone`. Convertir `trip_date` (YYYY-MM-DD local) a UTC antes de persistir. Exponer todos los timestamps en UTC. |
| **Frontend** | Convertir UTC a la zona horaria del cliente (`clients.timezone`) para mostrar. Enviar `trip_date` como `YYYY-MM-DD` local y `pickup_time` como `HH:mm` local. |
| **Cliente** | `clients.timezone` es la fuente de verdad para la presentación local. |
