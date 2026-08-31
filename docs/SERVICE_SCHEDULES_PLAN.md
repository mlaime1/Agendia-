# Service Schedules - Plan de Implementación

## Objetivo

Permitir que un cliente tenga múltiples horarios habituales por día, con distinta configuración para cada uno (ida, ida y vuelta, label descriptivo, etc.). Se crea como módulo nuevo: no reemplaza nada existente porque `pickup_time` / `return_time` nunca llegaron a implementarse en `clients` ni en `trips`.

---

## Contexto y decisiones previas

- **BD de prueba**: no hay datos reales, no hay backfill que diseñar.
- **DELETE policy**: hard delete. `is_active` queda como bandera para deshabilitar visualmente sin perder el registro.
- **FKs hacia schedules**: ninguna. `trips` copiará valores, nunca referenciará el `id` de un schedule.
- **Validación**: manual con `AppError(msg, statusCode)` en el service. El proyecto no usa Zod / Joi / class-validator.
- **Ownership**: se reutiliza `getClientAccessLevel(user, clientId)` desde `src/utils/calendarAuth.ts`, igual que el módulo `trips`.
- **Transacciones**: `prisma.$transaction(async (tx) => { ... })` estilo `auth/service.ts`.
- **Convención Prisma del proyecto**: snake_case directo, sin `@@map`.
- **Convención de respuestas**: `{ success: true, data }` / `{ success: false, message }`.
- **Nombre del módulo**: `src/modules/schedules/` (alineado con el modelo `service_schedules`).
- **Tests**: `jest.mock` del singleton de Prisma en `tests/unit/modules/schedules/service.test.ts`.

---

## Modelo de datos

```prisma
model service_schedules {
  id          BigInt    @id @default(autoincrement())
  client_id   BigInt
  day_of_week Int
  pickup_time String    @db.Time(0)
  return_time String?   @db.Time(0)
  label       String?   @db.VarChar(100)
  is_active   Boolean   @default(true)
  created_at  DateTime  @default(now()) @db.Timestamptz(6)
  updated_at  DateTime  @updatedAt @db.Timestamptz(6)

  client      clients   @relation(fields: [client_id], references: [id], onDelete: Cascade)

  @@unique([client_id, day_of_week, pickup_time])
  @@index([client_id])
}
```

Y agregar la relación inversa en `model clients`:

```prisma
service_schedules service_schedules[]
```

### Decisiones de modelo

- `day_of_week`: Int (1=Lunes .. 7=Domingo). Misma convención que `clients.billing_day` cuando el ciclo es `weekly`.
- `pickup_time`: NOT NULL. Todo horario tiene al menos una hora de ida.
- `return_time`: NULLABLE. Soporta "solo ida".
- `label`: `VarChar(100)`, opcional. Sirve para identificar el tramo ("Escuela", "Casa", "Depto").
- `is_active`: default `true`. Permite deshabilitar sin borrar.
- `@@unique([client_id, day_of_week, pickup_time])`: permite múltiples horarios por día, pero rechaza duplicados exactos.
- `onDelete: Cascade`: si se elimina el cliente, se eliminan sus horarios. Consistente con la lógica del dominio (un horario no existe sin su cliente).

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

## Endpoints

| Método   | Ruta                                | Descripción                                          |
| -------- | ----------------------------------- | ---------------------------------------------------- |
| `GET`    | `/clients/:id/schedules`            | Listar todos los horarios del cliente                |
| `POST`   | `/clients/:id/schedules`            | Agregar un horario                                   |
| `PUT`    | `/clients/:id/schedules`            | Reemplazar en lote todos los horarios del cliente   |
| `PATCH`  | `/clients/:id/schedules/:schedId`   | Editar un horario individual                         |
| `DELETE` | `/clients/:id/schedules/:schedId`   | Eliminar un horario                                  |

- Todas las rutas usan `verifyToken`.
- La autorización fina (que el cliente pertenezca al driver autenticado) se valida en el **service** usando `getClientAccessLevel(user, clientId)`. El access level mínimo es `read-only` para `GET` y `full` para el resto.
- El `PUT` en lote hace `deleteMany` + `createMany` dentro de un `prisma.$transaction`. Si el lote está vacío (`schedules: []`), se interpretan como "borrar todos".

---

## DTOs

```ts
export interface CreateScheduleDTO {
  day_of_week: number
  pickup_time: string
  return_time?: string | null
  label?: string | null
  is_active?: boolean
}

export interface UpdateScheduleDTO {
  day_of_week?: number
  pickup_time?: string
  return_time?: string | null
  label?: string | null
  is_active?: boolean
}

export interface BulkSchedulesDTO {
  schedules: CreateScheduleDTO[]
}
```

---

## Estructura del módulo

```
src/modules/schedules/
  types.ts       — DTOs
  service.ts     — Lógica de negocio + validaciones + transacciones
  controller.ts  — Handlers HTTP (try/catch por método)
  routes.ts      — Definición de endpoints con mergeParams

tests/unit/modules/schedules/
  service.test.ts
```

---

## Convención de zona horaria

El proyecto usa **UTC** consistente para todos los `DateTime` / `Timestamptz`.

- `pickup_time` y `return_time` usan `TIME(0)` (hora reloj, sin zona horaria).
- `created_at` y `updated_at` usan `@default(now())` y `@updatedAt` — Prisma + PostgreSQL los producen en UTC.
- Validaciones de hora: regex `^([01][0-9]|2[0-3]):[0-5][0-9]$`. Sin conversiones de zona horaria en el service (la hora es literal, igual que `clients.billing_cycle`).

---

## Pasos de implementación (orden de ejecución)

1. **Schema Prisma**
   - Editar `prisma/schema.prisma`.
   - Agregar `model service_schedules` al final del archivo.
   - Agregar la relación inversa `service_schedules service_schedules[]` dentro de `model clients`.

2. **Migración**
   - Correr `npx prisma migrate dev --name add_service_schedules`.
   - No hay backfill (BD de prueba, sin datos reales).
   - Verificar con `npx prisma studio` que la tabla existe y la FK a `clients` quedó bien.

3. **DTOs** — `src/modules/schedules/types.ts`
   - Copiar las 3 interfaces (`CreateScheduleDTO`, `UpdateScheduleDTO`, `BulkSchedulesDTO`).

4. **Service** — `src/modules/schedules/service.ts`
   - Importar `prisma` desde `../../config/prisma`.
   - Importar `AppError` desde `../../utils/AppError`.
   - Importar `getClientAccessLevel` desde `../../utils/calendarAuth`.
   - Importar `AuthRequest` o el tipo de `user` que use `calendarAuth`.
   - Helpers privados:
     - `validateDayOfWeek(n: number)`: lanza `AppError` si `n < 1 || n > 7`.
     - `validateTimeFormat(t: string)`: lanza `AppError` si no matchea `^([01][0-9]|2[0-3]):[0-5][0-9]$`.
     - `validateScheduleDTO(dto)`: llama los dos anteriores; si `return_time` viene definido, también lo valida.
   - Funciones exportadas:
     - `getByClient(clientId: bigint, user)` — chequea `getClientAccessLevel` (mínimo `read-only`), `prisma.service_schedules.findMany` con `orderBy: [{ day_of_week: 'asc' }, { pickup_time: 'asc' }]`.
     - `create(clientId: bigint, dto: CreateScheduleDTO, user)` — chequea nivel `full`, valida DTO, `prisma.service_schedules.create`. Si el insert viola el unique, Prisma tira `P2002`; capturarla y relanzar como `AppError('Ya existe un horario con ese día y hora', 409)`.
     - `update(clientId, scheduleId, dto, user)` — chequea nivel `full`, valida DTO parcial, `prisma.service_schedules.update({ where: { id }, data: { ... } })`. Verifica que el `scheduleId` pertenezca al `clientId` con un `findFirst` previo (si no, 404).
     - `remove(clientId, scheduleId, user)` — chequea nivel `full`, `delete` con `where: { id: scheduleId, client_id: clientId }`. Si devuelve `P2025` (no encontrado), relanzar como 404.
     - `bulkReplace(clientId, dto, user)` — chequea nivel `full`, valida cada DTO del array, `$transaction` con `deleteMany` + `createMany` (o `create` en loop si se prefiere mayor compatibilidad con el patrón del proyecto).

5. **Controller** — `src/modules/schedules/controller.ts`
   - Patrón `clients/controller.ts` (try/catch con status hardcodeado).
   - 5 handlers: `getByClient`, `create`, `bulkReplace`, `update`, `remove`.
   - `getByClient` y `remove` retornan 200; `create` y `bulkReplace` retornan 201; `update` 200; `remove` 200 con `data: null`.
   - Capturar `req.params.id` y `req.params.schedId` como `string`, convertirlos a `BigInt` en el service.
   - Pasar `req.user` al service para la validación de ownership.

6. **Routes** — `src/modules/schedules/routes.ts`
   - `Router({ mergeParams: true })` para heredar `:id` del padre.
   - `router.use(verifyToken)`.
   - 5 endpoints según la tabla.

7. **Montaje en router principal** — `src/routes/index.ts`
   - Importar: `import schedulesRoutes from '../modules/schedules/routes'`.
   - Agregar: `router.use('/clients/:id/schedules', schedulesRoutes)`.

8. **Tests unitarios** — `tests/unit/modules/schedules/service.test.ts`
   - Mockear `src/config/prisma` con todos los métodos que use el service.
   - Mockear `src/lib/supabase` (todos los tests lo hacen).
   - Mockear `src/utils/calendarAuth` con un helper para forzar `getClientAccessLevel` y devolver `full` / `read-only` / `none` según el caso.
   - Cubrir como mínimo:
     - `getByClient`: retorna ordenado, rechaza con 403 cuando el nivel es `none`.
     - `create`: happy path, rechaza `day_of_week = 0/8`, rechaza `pickup_time = "25:00"`, rechaza `pickup_time = "abc"`, traduce `P2002` a 409.
     - `update`: edición parcial, permite `return_time = null`, 404 si no pertenece al cliente.
     - `remove`: elimina, 404 si no existe.
     - `bulkReplace`: borra y crea, hace rollback si el insert falla (verificar que el `tx.deleteMany` no se commitea).

9. **Verificación**
   - `npx tsc --noEmit` — sin errores de tipos.
   - `npm test -- tests/unit/modules/schedules` — pasan los unit tests.
   - `npm test` — no se rompió nada existente.
   - Opcional: levantar el server y probar con `curl` los 5 endpoints.

---

## Validaciones centralizadas

| Validación                              | Error                                | Status |
| --------------------------------------- | ------------------------------------ | ------ |
| `day_of_week` fuera de 1-7              | `day_of_week debe ser 1..7`          | 400    |
| `pickup_time` con formato inválido      | `pickup_time debe ser "HH:mm"`       | 400    |
| `return_time` con formato inválido      | `return_time debe ser "HH:mm" o null`| 400    |
| `label` con más de 100 chars            | `label max 100 chars`                | 400    |
| `bulkReplace` con schedule inválido     | `schedules[0]: pickup_time...`       | 400    |
| Cliente no pertenece al driver          | `No tienes acceso a este cliente`    | 403    |
| Cliente no encontrado                   | `Cliente no encontrado`              | 404    |
| Horario no encontrado en update/delete  | `Horario no encontrado`              | 404    |
| Duplicado `(client, day, pickup_time)`  | `Ya existe un horario con ese día y hora` | 409 |

---

## Consideraciones a futuro (no bloqueantes)

- **Conversión hora-reloj → timestamp**: cuando se implemente el matching entre `service_schedules` y `trips`, hay que definir la zona horaria del cliente. Por ahora, ambos lados usan `trip_date` con `Timestamp` y los horarios usan `TIME(0)` literal — la conversión queda para el momento en que esa feature exista.
- **Índice compuesto**: hoy `@@index([client_id])`. Si el volumen crece, evaluar `(client_id, day_of_week, pickup_time)` para soportar lecturas filtradas y ordenadas sin sort.
- **Soft delete**: si más adelante se necesita historial real, cambiar el `DELETE` por `update({ is_active: false, deleted_at: new Date() })` y filtrar en los `findMany` con `where: { deleted_at: null }`. No hacerlo ahora (YAGNI).
- **i18n de labels**: `label` es libre por diseño. Si en el futuro se quiere autocompletar desde valores predefinidos, agregar una tabla `schedule_labels` o enum.
