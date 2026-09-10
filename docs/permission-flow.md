# Flujo de permisos — AgenDia

Documento de referencia del modelo de autorización completo (backend `Agendia-` + frontend `agendia-client`).
Autoridad final de seguridad: **backend**. El frontend solo controla visibilidad/UX, pero el backend rechaza lo no autorizado.

---

## 1. Resumen ejecutivo

- Hay **4 valores de rol en el backend** (`DRIVER | ADMIN | PASSENGER | client`), pero solo **2 actores de negocio**: **driver** y **client**.
- **ADMIN** no es un actor real: se registra como `DRIVER` (`registerAdmin` → `registerDriver`) y el frontend lo trata como driver.
- **PASSENGER** es una vista de cliente: el frontend lo normaliza a `'client'`.
- El **núcleo de acceso** del backend es `getClientAccessLevel(user, clientId)` → devuelve `'full' | 'read-only' | 'none'`.
- **Inconsistencia conocida**: el frontend permite al rol `client` crear viajes, pero el backend lo **niega** (ver §8).

---

## 2. Modelo de roles

### 2.1 Backend — fuente de verdad

| Rol | Dónde vive | Cómo se crea | Naturaleza |
|-----|-----------|--------------|------------|
| `DRIVER` | `users.role` (default) | `registerDriver` | Core operativo. Dueño de clients (`clients.driver_id`). |
| `ADMIN` | `users.role` | `registerAdmin` → **llama a `registerDriver`** | No es un rol distinto: se crea como DRIVER. |
| `PASSENGER` | `users.role` | `registerPassenger` (código de invitación) | Usuario vinculado a clients vía `client_passengers`. |
| `client` | **no es enum** — sintético | `verifyToken` si el `auth_id` matchea una fila de `clients` | La entidad cliente real (tabla `clients`). |

```prisma
// prisma/schema.prisma:185
enum Role {
  DRIVER
  ADMIN
  PASSENGER
}
```

```ts
// src/utils/calendarAuth.ts:6
export interface AuthUser {
  authId: string
  role: $Enums.Role | 'client'
  dbId: bigint
}
```

### 2.2 Frontend — colapsado

```ts
// agendia-client/src/features/auth/types/user.ts:1
export type UserRole = 'driver' | 'admin' | 'client' | 'unknown';
```

No existe `'passenger'`. La normalización lo colapsa a `'client'` (§6.1).

---

## 3. Capas de autorización

```
[Cliente]
   │  JWT (Supabase Auth)
   ▼
[verifyToken]  ── resuelve identidad → req.user { authId, role, dbId, phone }
   │
   ├── [requireRole]        → middleware de ruta (match exacto de rol)
   │
   ▼
[Service layer]
   ├── requireAuth(user)        → 403 si no hay user
   ├── getClientAccessLevel()   → 'full' | 'read-only' | 'none'   ★ NÚCLEO
   ├── requireFullAccess()      → exige 'full'
   ├── requireReadAccess()      → exige != 'none'
   ├── ensureFullAccess()       → exige 'full' (mensajes distintos)
   ├── ensureReadAccess()       → exige != 'none'
   ├── belongsToClient()        → ownership de un recurso dentro del client
   └── assertClientOwnership()  → 403 si el recurso no pertenece al client
```

---

## 4. Backend en detalle

### 4.1 `verifyToken` — identidad (`src/middlewares/verifyToken.ts`)

Resuelve el token en Supabase y busca en BD:

1. `prisma.users.findUnique({ auth_id })` → si existe, `req.user.role = dbUser.role` (`DRIVER|ADMIN|PASSENGER`).
2. Si no, `prisma.clients.findUnique({ auth_id })` → `req.user.role = 'client'` (sintético).
3. Si nada, `401`.

### 4.2 `getClientAccessLevel` — el núcleo (`src/utils/calendarAuth.ts:28`)

Es la función central: **todo** el acceso a un `client` pasa por acá.

```ts
export async function getClientAccessLevel(user: AuthUser, clientId: bigint): Promise<AccessLevel> {
  if (user.role === 'ADMIN') return 'full'                       // admin siempre full
  if (user.role === 'DRIVER') {
    // full si client.driver_id === user.dbId, sino none
  }
  if (user.role === 'PASSENGER') {
    // read-only si existe client_passengers, sino none
  }
  if (user.role === 'client') {
    return user.dbId === clientId ? 'read-only' : 'none'         // cliente real = read-only
  }
  return 'none'
}
```

**Tabla de niveles:**

| Rol | `full` | `read-only` | `none` |
|-----|--------|-------------|--------|
| `ADMIN` | **siempre** | — | — |
| `DRIVER` | si `client.driver_id === user.dbId` | — | si no es su client |
| `PASSENGER` | — | si hay link `client_passengers` | si no hay link |
| `client` | — | si `user.dbId === clientId` | si no es ese client |
| `unknown` | — | — | siempre |

> ⚠️ El rol `client` **nunca** obtiene `full`. Esto es clave para la inconsistencia de §8.

### 4.3 `requireRole` — middleware de ruta (`src/middlewares/requireRole.ts`)

```ts
export function requireRole(role: Role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401)...
    if (req.user.role !== role) return res.status(403)...  // MATCH EXACTO
    next()
  }
}
```

**Match exacto** de rol. Solo se usa en `src/modules/invitations/routes.ts`:

```ts
router.post('/', verifyToken, requireRole('DRIVER'), controller.create)   // solo DRIVER
router.get('/',  verifyToken, requireRole('DRIVER'), controller.list)
```

> ⚠️ Como exige `role === 'DRIVER'`, un `ADMIN` (role `'ADMIN'`) **no pasa** → 403. Ver §8.

### 4.4 Helpers por servicio

| Helper | Archivo | Condición | Uso típico |
|--------|---------|-----------|------------|
| `requireAuth(user)` | `trips/service.ts:53` | `!user` → 403 | entradas de viajes |
| `requireFullAccess(user, clientId, ctx)` | `itinerary/service.ts:48`, `summaries/service.ts:43` | `level !== 'full'` → 403 | crear/editar/borrar |
| `requireReadAccess(user, clientId, ctx)` | `summaries/service.ts:50` | `level === 'none'` → 403 | leer |
| `ensureFullAccess(user, clientId)` | `schedules/service.ts:55` | `none`→403, `!=full`→403 | horarios |
| `ensureReadAccess(user, clientId)` | `schedules/service.ts:65` | `none` → 403 | horarios |
| `belongsToClient(ownerId, clientId)` | `trips/service.ts:58` | `ownerId == null \|\| ownerId === clientId` | ownership |
| `assertClientOwnership(...)` | `trips/service.ts:63` | `!belongsToClient` → 403 | ruta/tarifa |

> ⚠️ **Gap potencial**: en `itinerary/service.ts:53`, `requireFullAccess` hace `if (!user) return` (no bloquea si `user` es `undefined`). Para operaciones de escritura debería exigir user presente. Revisar antes de exponer esas rutas sin `verifyToken`.

---

## 5. Matriz de operaciones por rol (backend)

`✓` = permitido, `✗` = denegado, `🔒` = solo `full`, `👁` = solo lectura.

| Operación | ADMIN | DRIVER | PASSENGER | client |
|-----------|:-----:|:------:|:---------:|:------:|
| **Trips** | | | | |
| `getAll` | 🔒 todos | 🔒 sus clients | 🔒 linked | 🔒 su client |
| `getById` / `getByClient` / `getByDateRange` | ✓ | ✓ (suyos) | 👁 | 👁 |
| `create` | 🔒 full | 🔒 full | ✗ | ✗ |
| `update` / `delete` / `startTrip` / `addStop` / `endTrip` | 🔒 full | 🔒 full | ✗ | ✗ |
| **Clients** | | | | |
| `getById` | ✓ | ✓ | 👁 | 👁 |
| `create` | ✓ | ✓ | ✗ | ✗ |
| `update` / `updateBillingConfig` / `remove` | 🔒 full | 🔒 full | ✗ | ✗ |
| **Itinerary (routes)** | | | | |
| `getById` | ✓ | ✓ | 👁 | 👁 |
| `create` / `update` / `remove` / `getStops` / `createStop` | 🔒 full | 🔒 full | ✗ | ✗ |
| **Schedules** | | | | |
| `getByClient` | ✓ | ✓ | 👁 | 👁 |
| `create` / `update` / `remove` | 🔒 full | 🔒 full | ✗ | ✗ |
| **Summaries** | | | | |
| `getAllByClient` / `getById` | ✓ | ✓ | 👁 | 👁 |
| `createSummaryManual` / `updateStatus` / `deleteSummary` / `paySummary` | 🔒 full | 🔒 full | ✗ | ✗ |
| **Payments** | | | | |
| `getByTrip` | ✓ | ✓ | 👁 | 👁 |
| `create` / `update` / `delete` | 🔒 full | 🔒 full | ✗ | ✗ |
| **Invitations** | | | | |
| `create` / `list` | ✗ | ✓ | ✗ | ✗ |
| `validateCode` | público | público | público | público |

> **ADMIN en invitaciones**: el frontend le otorga permisos, pero `requireRole('DRIVER')` lo bloquea. Ver §8.

---

## 6. Frontend en detalle

### 6.1 Normalización de rol (`agendia-client/src/state/AuthContext.tsx`)

```ts
// :44
const normalizeRole = (role: unknown): 'driver' | 'admin' | 'client' | 'unknown' => {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  if (normalizedRole === 'admin') return 'admin';
  if (normalizedRole === 'driver') return 'driver';
  if (normalizedRole === 'client' || normalizedRole === 'passenger') return 'client'; // ← PASSENGER → client
  return 'unknown';
};
```

- **PASSENGER → `client`** (no a `unknown`).
- `normalizeBackendProfile` (:79) toma `role`, y si da `unknown` prueba con `backendProfile.type`; `linked_client_id` cae a `clients[0].id` si el rol es `client`.

### 6.2 Policy de permisos (`agendia-client/src/permissions/policy.ts`)

```ts
const DRIVER_PERMISSIONS = { ...ALL_PERMISSIONS };      // driver = todo
const CLIENT_PERMISSIONS = {
  dashboard: true, calendar: true, summaries: true,
  clients: false, clientCreation: false, clientEditing: false,
  invitations: false, trips: false, summaryManagement: false, payments: false,
};
// admin → ALL_PERMISSIONS ; unknown/null → NO_PERMISSIONS
// isResolved = role no null/undefined/'unknown'
```

| Capability | Admin | Driver | Client |
|-----------|:-----:|:------:|:------:|
| dashboard | ✓ | ✓ | ✓ |
| clients | ✓ | ✓ | ✗ |
| clientCreation / clientEditing | ✓ | ✓ | ✗ |
| invitations | ✓ | ✓ | ✗ |
| calendar | ✓ | ✓ | ✓ |
| trips | ✓ | ✓ | ✗ |
| summaries | ✓ | ✓ | ✓ |
| summaryManagement | ✓ | ✓ | ✗ |
| payments | ✓ | ✓ | ✗ |

> ⚠️ `policy.ts` da `invitations: true` a **admin** y `trips: false` a **client** — pero `useCalendarPermissions` (abajo) contradice el `trips` del client. Ver §8.

### 6.3 Permisos de calendario (`useCalendarPermissions.ts`)

```ts
const isDriver = role === 'driver' || role === 'admin';
const isClient = role === 'client';
const canCreateRegularTrips = isDriver || isClient;   // ← client SÍ crea viajes (UI)
const canCreateSpecialTrips = isDriver || isClient;
const canEdit = isDriver;            // editar/precio/borrar/pagar = solo driver/admin
const resolvedClientId = isDriver ? selectedClientId
                      : isClient ? (linkedClientId || undefined)
                      : undefined;
```

### 6.4 Enrutamiento (`App.tsx`)

- `permissions = usePermissions(userProfile)` (:68).
- Si `role === 'client'` → `loadLinkedClient(linked_client_id)` y `setSelectedClientId(linkedClientId)` (:131-136); si no → `loadClients()`.
- `handleNavigate` (:141) gatea por `permissions.can.<route>`:
  - Calendario → `can.calendar && can.dashboard`
  - Historial → `can.calendar`
  - Recorridos → `can.trips`
  - Resumenes → `can.summaries`
  - Clientes → `can.clients`
  - Perfil → `isResolved`
- `useCalendarTrips` (:51) define `isClient = userRole === 'client'` y usa `linkedClientId` como contexto del cliente.

---

## 7. Matriz consolidada frontend vs backend

| Acción | Frontend (UI) | Backend (autoridad) | ¿Coincide? |
|--------|:-------------:|:-------------------:|:----------:|
| Client crea viaje | ✓ (`canCreateRegularTrips`) | ✗ (`level !== 'full'` → 403) | ❌ **NO** |
| Admin crea invitación | ✓ (`invitations: true`) | ✗ (`requireRole('DRIVER')`) | ❌ **NO** |
| Client ve resumen | ✓ | 👁 (`read-only`) | ✅ |
| Client ve calendario | ✓ | 👁 | ✅ |
| Driver edita/borra/paga | ✓ | 🔒 `full` | ✅ |
| Admin crea client | ✓ | ✓ (`role ADMIN/DRIVER`) | ✅ |

---

## 8. Inconsistencias / puntos calientes

1. **Client/PASSENGER no puede crear viajes (backend), aunque el frontend lo muestra.**
   - Frontend: `useCalendarPermissions.ts:29` → `canCreateRegularTrips = isDriver || isClient`.
   - Backend: `tripService.create` (`trips/service.ts:162`) exige `level === 'full'`; el rol `client`/`PASSENGER` da `read-only` → **403**.
   - El branch `trips/service.ts:171` (`role === 'PASSENGER' || role === 'client'` → `user_id = driverId`) es **código muerto**: nunca se alcanza porque el gate de línea 162 lo bloquea antes.
   - Probable intención: permitir que el cliente registre viajes (asignándolos al chofer), pero el gate lo impide.

2. **Admin bloqueado en invitaciones por `requireRole('DRIVER')`.**
   - Frontend (`policy.ts`) da `invitations: true` a admin; backend exige `role === 'DRIVER'` exacto → admin recibe 403.
   - `requireRole` es match exacto, no "al menos driver".

3. **`requireFullAccess` en itinerary retorna temprano si `!user`** (`itinerary/service.ts:53`). Para escritura no debería permitir sin autenticación. Verificar que esas rutas siempre monten `verifyToken`.

4. **`ADMIN` es un DRIVER con privilegios**, no un rol modelado. `registerAdmin` = `registerDriver`. Cualquier regla de negocio que distinga admin de driver se apoya en `user.role === 'ADMIN'`, pero la creación es idéntica.

5. **`client` es `read-only` en backend, pero el frontend le da `canCreateTrips`.** Es la mayor fuente de confusión. Si el producto quiere que el cliente cree viajes, hay que subir su nivel a `full` (o relajar el gate de `create`); si no, hay que quitar `canCreateRegularTrips` del frontend.

---

## 9. Flujo de ejemplo — driver crea un viaje

1. **Auth**: `login` → Supabase emite JWT.
2. **`verifyToken`**: valida JWT, busca `users` por `auth_id` → `req.user = { role: 'DRIVER', dbId }`.
3. **`POST /trips`** → `tripService.create`.
4. **`requireAuth(user)`**: user presente.
5. **`getClientAccessLevel(user, client_id)`**: `clients.driver_id === user.dbId` → `'full'`.
6. **`level === 'full'`** → pasa el gate (línea 162).
7. **`user.role === 'DRIVER'`** → `user_id = user.dbId` (el chofer es quien conduce).
8. Valida ruta/tarifa con `assertClientOwnership`, calcula precio, inserta el trip.

Un `client` que intente lo mismo: paso 5 da `'read-only'` → paso 6 falla → **403 "No tienes permisos para crear viajes"**.

---

## 10. Archivos clave

**Backend (`Agendia-`)**
- `src/middlewares/verifyToken.ts` — identidad
- `src/middlewares/requireRole.ts` — middleware de ruta
- `src/utils/calendarAuth.ts` — `getClientAccessLevel`, `AuthUser`
- `src/modules/trips/service.ts` — `requireAuth`, `belongsToClient`, `create`
- `src/modules/schedules/service.ts` — `ensureFullAccess`, `ensureReadAccess`
- `src/modules/summaries/service.ts` — `requireFullAccess`, `requireReadAccess`
- `src/modules/itinerary/service.ts` — `requireFullAccess`
- `src/modules/clients/service.ts` — `create` (rol explícito), acceso `full`
- `src/modules/payments/service.ts` — acceso `full`/`read-only`
- `src/modules/invitations/routes.ts` — `requireRole('DRIVER')`
- `prisma/schema.prisma:185` — enum `Role`

**Frontend (`agendia-client`)**
- `src/state/AuthContext.tsx` — `normalizeRole`, `normalizeBackendProfile`
- `src/features/auth/types/user.ts` — `UserRole`
- `src/permissions/policy.ts` — `PermissionSet` por rol
- `src/permissions/usePermissions.ts`
- `src/features/calendar/hooks/useCalendarPermissions.ts`
- `src/features/calendar/hooks/useCalendarTrips.ts` — `isClient`, `linkedClientId`
- `App.tsx` — enrutamiento por `permissions.can`
