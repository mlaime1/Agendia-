# Service Schedules - Plan de Implementación

## Objetivo

Permitir que un cliente tenga múltiples horarios habituales por día, con distinta configuración para cada uno. Reemplaza el diseño inicial del plan CLIENTES que asumía un solo `pickup_time` / `return_time` para todos los días.

---

## Modelo de datos

```prisma
model service_schedules {
  id          BigInt    @id @default(autoincrement())
  client_id   BigInt
  day_of_week Int       // 1=Lunes .. 7=Domingo
  pickup_time String    @db.Time(0)   // "HH:mm" — siempre requerido
  return_time String?   @db.Time(0)   // "HH:mm" — nullable (solo ida)
  label       String?                  // opcional: "Escuela", "Casa"
  is_active   Boolean   @default(true)
  created_at  DateTime  @default(now()) @db.Timestamptz(6)
  updated_at  DateTime  @updatedAt @db.Timestamptz(6)

  client      clients   @relation(fields: [client_id], references: [id], onDelete: Cascade)

  @@unique([client_id, day_of_week, pickup_time])
  @@index([client_id])
}
```

### Decisiones

- `day_of_week`: Int (1=Lunes, 7=Domingo). Simple, flexible, fácil de traducir en frontend.
- `pickup_time`: NOT NULL. Siempre hay al menos una hora de ida.
- `return_time`: NULLABLE. La mayoría de los clientes contratan solo ida.
- `label`: opcional. Para que el conductor identifique el tramo ("Escuela", "Casa", "Depto").
- `is_active`: permite deshabilitar temporalmente un horario sin borrarlo.
- Unique constraint en `[client_id, day_of_week, pickup_time]` evita duplicados exactos pero permite múltiples horarios por día (ej: martes con pickup a 12:50, 14:05 y 15:00).

---

## Casos de uso cubiertos

### Caso 1: Ida y vuelta clásico

```
día=Lunes, pickup=07:30, return=16:00
```

### Caso 2: Solo ida

```
día=Martes, pickup=09:00, return=null
```

### Caso 3: Múltiples viajes en un mismo día

```
día=Martes, pickup=12:50, label="Escuela"
día=Martes, pickup=14:05, label="Depto"
día=Martes, pickup=15:00, label="Escuela → Amoedo"
```

---

## Estructura del módulo

```
src/modules/contracts/
  types.ts       — DTOs (CreateScheduleDTO, UpdateScheduleDTO)
  service.ts     — Lógica de negocio
  controller.ts  — Handlers HTTP
  routes.ts      — Definición de endpoints
```

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/clients/:id/schedules` | Listar todos los horarios de un cliente |
| `POST` | `/clients/:id/schedules` | Agregar un horario |
| `PUT` | `/clients/:id/schedules` | Reemplazar en lote todos los horarios (recibe `{ schedules: [...] }`) |
| `PATCH` | `/clients/:id/schedules/:schedId` | Editar un horario |
| `DELETE` | `/clients/:id/schedules/:schedId` | Eliminar un horario |

Todas las rutas requieren `verifyToken` y que el usuario autenticado sea el `DRIVER` dueño del cliente.

El endpoint `PUT` en lote reemplaza **todos** los horarios del cliente: borra los existentes y crea los nuevos en una transacción. Pensado para el form "Editar Contrato" donde el usuario modifica todo y guarda con un solo request.

---

## DTOs

```ts
interface CreateScheduleDTO {
  day_of_week: number      // 1-7
  pickup_time: string      // "HH:mm"
  return_time?: string | null
  label?: string | null
  is_active?: boolean      // default true
}

interface UpdateScheduleDTO {
  day_of_week?: number
  pickup_time?: string
  return_time?: string | null
  label?: string | null
  is_active?: boolean
}

interface BulkSchedulesDTO {
  schedules: CreateScheduleDTO[]
}
```

---

## Pasos de implementación

1. Agregar modelo `service_schedules` a `prisma/schema.prisma`
2. Correr migración: `npx prisma migrate dev --name add_service_schedules`
3. Crear `src/modules/contracts/types.ts` con los DTOs
4. Crear `src/modules/contracts/service.ts` con la lógica
5. Crear `src/modules/contracts/controller.ts` con los handlers
6. Crear `src/modules/contracts/routes.ts` con los endpoints
7. Crear `tests/unit/modules/contracts/service.test.ts` con tests unitarios del service
8. Montar rutas en `src/routes/index.ts`

---

## Convención de zona horaria

El proyecto usa **UTC** de forma consistente para todos los `DateTime` / `Timestamptz` (ver `billingPeriod.ts`, `summaries/service.ts`).

- `pickup_time` y `return_time` usan `TIME(0)` (sin zona horaria, representan hora reloj: "07:30", "12:50").
- `created_at` y `updated_at` usan `Timestamptz`. Deben seguir el patrón del resto del proyecto: `@default(now())` y `@updatedAt` ya producen UTC por defecto con Prisma + PostgreSQL.
- Cualquier fecha generada en código (ej: validaciones) debe usar `setUTCHours(0, 0, 0, 0)` o equivalentes, como hace el módulo de summaries.

---

## Tests

Crear tests unitarios para el service en `tests/unit/modules/contracts/service.test.ts`. Cubrir al menos:

- `getByClient`: retorna horarios ordenados por día y hora.
- `create`: crea un horario y valida `day_of_week` (1-7) y formato `HH:mm`.
- `update`: modifica campos parciales, permite setear `return_time = null`.
- `delete`: elimina un horario, retorna error si no existe.
- `bulkReplace`: borra horarios existentes y crea los nuevos en transacción. Si falla un insert, hace rollback de todo el batch.
- Validación: rechaza `pickup_time` inválido ("25:00", "abc"), rechaza `day_of_week` fuera de rango (0, 8).
- Validación: rechaza crear horario para un cliente que no pertenece al driver autenticado (esta validación va en el controller/route, pero el service recibe `clientId` + `driverId`).
