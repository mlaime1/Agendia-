# Plan de implementación: sistema de roles y acceso al calendario

## Stack
- Backend: Node.js + Express + TypeScript
- Base de datos: PostgreSQL (Supabase local en dev)
- ORM: Prisma 7
- Auth: Supabase Auth (JWT)
- Rama: `dev`

---

## 1. Arquitectura del modelo de datos

### Modelo conceptual

```
users (DRIVER)
  ├── clients (pasajeros que maneja)
  ├── trips (viajes que conduce)
  ├── summaries (facturación)
  └── invitation_codes (códigos que genera)

users (PASSENGER)
  └── client_passengers → clients (acceso a calendarios)

clients (persona transportada)
  ├── driver_id → users (DRIVER) ← chofer asignado
  ├── client_passengers → users (PASSENGER) ← 1..N usuarios con acceso
  ├── trips (su calendario)
  ├── routes, rates, summaries
  └── billing_cycle, billing_day, billing_start_date
```

### Relaciones clave

| Relación | Tipo | Descripción |
|----------|------|-------------|
| Driver → Client | 1:N | Un chofer tiene varios pasajeros |
| Passenger → Client | N:N (via client_passengers) | Un pasajero puede ver varios clients; un client puede tener varios pasajeros (cuidadores) |
| Client → Driver | N:1 | Via client.driver_id |
| Trip → Driver | N:1 | trip.user_id = driver |
| Trip → Client | N:1 | trip.client_id = client |
| Driver → InvitationCode | 1:N | Un chofer genera muchos códigos |

### Flujo de registro

1. Chofer genera código de invitación (con o sin client existente)
2. Pasajero/cuidador abre la app, va a register
3. Ingresa: email, password, name, phone, invitation_code
4. Backend valida el código, crea usuario PASSENGER, lo vincula al client
5. Si el código no tenía client_id: se crea un nuevo clients con billing_cycle='monthly'

---

## 2. Cambios en el esquema de base de datos

### a) Enum Role — agregar PASSENGER

```prisma
enum Role {
  DRIVER
  ADMIN
  PASSENGER   // nuevo
}
```

### b) Nueva tabla: invitation_codes

```prisma
model invitation_codes {
  id          BigInt    @id @default(autoincrement())
  code        String    @unique
  driver_id   BigInt
  client_id   BigInt?                   // null = se creará nuevo client al registrarse
  created_at  DateTime  @default(now()) @db.Timestamptz(6)
  expires_at  DateTime  @db.Timestamptz(6)
  used_at     DateTime? @db.Timestamptz(6)
  used_by_id  BigInt?

  driver      users    @relation("InvitationCreator", fields: [driver_id], references: [id])
  client      clients? @relation(fields: [client_id], references: [id])
  used_by     users?   @relation("InvitationUsedBy", fields: [used_by_id], references: [id])

  @@index([code])
  @@index([driver_id])
}
```

### c) Nueva tabla: client_passengers

```prisma
model client_passengers {
  client_id BigInt
  user_id   BigInt
  added_at  DateTime @default(now()) @db.Timestamptz(6)

  client clients @relation(fields: [client_id], references: [id], onDelete: Cascade)
  user   users   @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([client_id, user_id])
  @@index([user_id])
}
```

### d) Relaciones nuevas en users

```prisma
model users {
  // ... campos existentes ...
  clients            clients[]           // driver → sus clients (existente)
  client_passengers  client_passengers[] // pasajero → clients vinculados
  invitations_created invitation_codes[] @relation("InvitationCreator")
  invitations_used   invitation_codes[] @relation("InvitationUsedBy")
}
```

---

## 3. Modificaciones a endpoints existentes

### POST /auth/register

**Cambio**: Ahora requiere `invitation_code`. Crea usuario con `role: PASSENGER`.

```
Body: { email, password, name, invitation_code }

Lógica:
1. Validar invitation_code:
   - Existe en DB
   - expires_at > now()
   - used_at IS NULL
2. Crear usuario en Supabase Auth (admin.createUser)
3. Crear users con role: PASSENGER
4. Si invitation.client_id tiene valor:
   - Crear client_passengers(client_id, user_id)
5. Si invitation.client_id es NULL:
   - Crear clients con:
     nombre = body.name
     phone = body.phone
     driver_id = invitation.driver_id
     billing_cycle = 'monthly'
   - Crear client_passengers(client_id_nuevo, user_id)
6. Marcar invitation_code como usado: used_at = now(), used_by_id = user_id
7. Login automático y devolver sesión
```

### POST /clients (crear cliente)

**Cambio**: Asignar `driver_id` desde el token, no del body.

- Controller: cambia a `AuthRequest`, pasa `req.user!.dbId`
- Service: recibe `driverId` como parámetro

### GET /trips y endpoints de trips

**Cambio**: Filtrar según rol del usuario autenticado.

- Driver: solo trips donde `user_id = driver.id` o `client.driver_id = driver.id`
- Passenger: solo trips donde `client_id IN (client_passengers)` o trips del driver (read-only si billing terminó)
- `user_id` en creación de trips: se deriva del token, no del body

---

## 4. Nuevos endpoints

### Módulo invitations

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /invitations | verifyToken + requireRole('DRIVER') | Crear código de invitación |
| GET | /invitations | verifyToken + requireRole('DRIVER') | Listar códigos del driver |
| GET | /invitations/:code | Público | Validar código (para form de registro) |

**POST /invitations — body:**
```json
{
  "client_id": "42" | null,
}
```

- Si `client_id` es null: el código es para un nuevo pasajero (se creará client al registrarse)
- Si `client_id` tiene valor: el código es para un cuidador (se vincula al client existente)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "code": "A1B2C3D4",
    "expires_at": "2026-06-04T18:00:00Z"
  }
}
```

### GET /invitations/:code (público)

Usado por la pantalla de registro para verificar si el código es válido antes de enviar el form.

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "client_id": "42" | null
  }
}
```

---

## 5. Middleware y lógica de autorización

### Nueva función: src/utils/calendarAuth.ts

```typescript
type AccessLevel = 'full' | 'read-only' | 'none'

function getTripAccessLevel(user: AuthUser, trip: Trip): Promise<AccessLevel>
function getClientAccessLevel(user: AuthUser, clientId: bigint): Promise<AccessLevel>
function isBillingActive(clientId: bigint): Promise<boolean>
```

**isBillingActive:**
1. Buscar último summary del cliente ordenado por period_end DESC
2. Si no hay summary → activo (full access)
3. Si el último summary tiene period_end >= current_date → activo
4. Si period_end < current_date → finalizado

**getTripAccessLevel:**

| Rol | Condición | Nivel |
|-----|-----------|-------|
| DRIVER | trip.user_id === user.dbId | full |
| DRIVER | trip.client.driver_id === user.dbId y billing activo | full |
| DRIVER | trip.client.driver_id === user.dbId y billing finalizado | read-only |
| PASSENGER | trip.client_id IN client_passengers | full |
| PASSENGER | trip.user_id === driver del client y billing finalizado | read-only |
| resto | | none |

### Modificaciones en trips/service.ts

Cada método debe verificar acceso:

- **getAll**: Filtrar según rol (driver ve sus trips + clients; passenger ve sus clients + trips driver read-only)
- **getById**: Verificar que el usuario tenga acceso al trip
- **getByClient / getByDateRange**: Verificar acceso al client
- **create**: Driver → user_id = req.user.dbId, client debe ser suyo. Passenger → user_id = client.driver_id, client debe estar en sus client_passengers
- **update / delete**: Solo si nivel full

### Modificaciones en trips/controller.ts

- Cambiar de `Request` a `AuthRequest`
- Pasar `req.user` al service

---

## 6. Modificación del trigger de Supabase

El trigger `on_auth_user_created` actualmente inserta automáticamente un `users` con role DRIVER. Como ahora el backend controla la creación:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (auth_id, name, email, role)
  VALUES (new.id, new.raw_user_meta_data ->> 'name', new.email, 'DRIVER')
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN new;
END;
$$;
```

El `ON CONFLICT (auth_id) DO NOTHING` permite que cuando el backend ya creó el registro (para PASSENGER), el trigger no lo sobrescriba. Para drivers creados desde el admin page, el trigger funciona como antes.

---

## 7. Registro de drivers (admin page)

El admin page puede:
- **Opción A**: Usar el mismo endpoint `/auth/register` con un header `Admin-Key` que el backend valida contra `process.env.ADMIN_KEY`. Si está presente → crea DRIVER.
- **Opción B**: Llamar directamente a `supabase.auth.admin.createUser()` desde el admin page. El trigger `on_auth_user_created` crea el `users` con role DRIVER automáticamente.

Se recomienda **Opción A** para mantener todo centralizado en el backend.

---

## 8. Migración de datos

No hay datos reales (solo prueba). Pasos:

```bash
npx prisma migrate dev --name roles_and_invitations
```

Esto generará:
- `ALTER TYPE "Role" ADD VALUE 'PASSENGER'`
- `CREATE TABLE "invitation_codes" (...)` 
- `CREATE TABLE "client_passengers" (...)`

---

## 9. Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | +PASSENGER enum, +invitation_codes, +client_passengers |
| `src/modules/invitations/types.ts` | CREAR |
| `src/modules/invitations/service.ts` | CREAR |
| `src/modules/invitations/controller.ts` | CREAR |
| `src/modules/invitations/routes.ts` | CREAR |
| `src/utils/calendarAuth.ts` | CREAR (helpers de autorización) |
| `src/modules/auth/types.ts` | +invitation_code en RegisterDTO |
| `src/modules/auth/service.ts` | Reescribir register con validación de código |
| `src/modules/auth/controller.ts` | Ajustar manejo de errores |
| `src/modules/auth/routes.ts` | Agregar verifyToken a register? (no, es público) |
| `src/modules/clients/service.ts` | +driverId en create |
| `src/modules/clients/controller.ts` | AuthRequest, pasar req.user |
| `src/modules/trips/service.ts` | +autorización por rol |
| `src/modules/trips/controller.ts` | AuthRequest, pasar req.user |
| `src/modules/trips/types.ts` | Opcional: sacar user_id de CreateTripDto |
| `src/modules/users/service.ts` | getMe para PASSENGER (devolver clients vinculados) |
| `src/routes/index.ts` | +router.use('/invitations') |
| Supabase migration SQL | Modificar trigger handle_new_user |

---

## 10. Orden de implementación

| Paso | Descripción |
|------|-------------|
| 1 | Modificar schema.prisma (enum + modelos) |
| 2 | Agregar Admin-Key a env.ts |
| 3 | Modificar trigger de Supabase (ON CONFLICT DO NOTHING) |
| 4 | Ejecutar `prisma migrate dev` |
| 5 | Crear `src/utils/calendarAuth.ts` |
| 6 | Crear módulo `invitations` (types, service, controller, routes) |
| 7 | Modificar `auth/service.ts` (register con invitation_code) |
| 8 | Modificar `clients` (driver_id desde token) |
| 9 | Modificar `trips` (autorización, AuthRequest, user_id desde token) |
| 10 | Actualizar `users/service.ts` (getMe para PASSENGER) |
| 11 | Agregar ruta `/invitations` en `routes/index.ts` |
| 12 | Verificar que compile (`npm run build`) |
| 13 | Pruebas con Supabase local |

---

## 11. Decisiones de diseño

| Decisión | Opción elegida |
|----------|---------------|
| ¿El "calendario" es una entidad propia? | No, es vista filtrada de trips |
| ¿Cuándo finaliza un período de facturación? | Cuando current_date > último summary.period_end |
| ¿Passenger ve calendario del driver durante billing? | No. Solo al finalizar, y solo read-only |
| ¿El client se crea al generar el código o al registrarse? | Al registrarse (evita clients huérfanos) |
| ¿Múltiples PASSENGER users por client? | Sí, via client_passengers (cuidadores) |
| ¿Un PASSENGER user puede ver múltiples clients? | Sí, via client_passengers |
