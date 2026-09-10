# Modelo de roles: problemática y solución

## Decisión

La base de datos **no debe reestructurarse ni migrarse**. El modelo de datos actual ya permite representar el negocio; el problema principal es semántico:

- `passenger` es la persona física transportada de A a B.
- `client` es la persona que tiene una cuenta, accede a la aplicación y registra viajes.
- Un `passenger` puede autogestionarse y ser también `client`.
- El chofer, los viajes, las rutas, los resúmenes y el estado de pago se asignan al `passenger`.
- Un `client` accede a uno o más `passenger` mediante una relación muchos-a-muchos.

La solución recomendada es **corregir los nombres en el código sin cambiar los nombres físicos de la base de datos**, usando el mapeo de Prisma (`@@map` y `@map`) y una política de permisos por capacidad.

### Terminología

En este documento usamos **caso de uso de autogestión** o **historia de usuario de autogestión**. La traducción correcta de *user story* es **historia de usuario**; *user history* significaría “historial del usuario” y no describe este requisito.

---

## 1. Problemática

### 1.1 Los conceptos de negocio y los nombres técnicos están cruzados

En el código actual:

| Concepto real | Nombre actual en el código | Problema |
|---|---|---|
| Persona transportada | Tabla `clients` | El nombre sugiere que es una cuenta, pero contiene el pasajero, sus viajes, rutas y facturación. |
| Persona con cuenta | `users.role = PASSENGER` | El nombre sugiere que es quien viaja, pero representa al usuario que accede a la app. |
| Acceso client → passenger | `client_passengers` con `client_id` hacia `clients` | La relación existe, pero sus nombres de columnas no representan claramente el significado real. |

Esto provoca errores de interpretación. Por ejemplo, `PASSENGER` no significa actualmente “persona transportada”; identifica a un usuario autenticado que tiene acceso a la información de un pasajero.

### 1.2 El modelo de permisos mezcla acceso con capacidades

El backend usa `getClientAccessLevel()` con tres niveles:

```text
full | read-only | none
```

Ese modelo funciona para distinguir al chofer del usuario asociado, pero no expresa correctamente el caso de negocio de autogestión:

- Un `client` puede **leer** la información del passenger.
- Un `client` puede **registrar viajes** cuando tiene acceso al passenger correspondiente.
- Un `client` no necesariamente puede editar rutas, borrar viajes, administrar horarios o modificar la configuración del passenger.

En el caso de María, ella contrató el servicio para sí misma. Por lo tanto, María es simultáneamente:

- `passenger`: la persona que será transportada.
- `client`: la persona autenticada que accede a la aplicación y registra sus propios viajes.

Por eso no conviene convertir automáticamente a todo `client` en `full`. La autorización debe expresarse por operación.

### 1.3 Frontend y backend no tienen el mismo contrato

Actualmente el frontend habilita correctamente la creación de viajes para un `client` en el caso de autogestión:

```ts
const canCreateRegularTrips = isDriver || isClient;
```

Pero el backend exige `level === 'full'` en `tripService.create()`. El `client` recibe actualmente `read-only`, aunque el caso de uso de María requiere que pueda registrar viajes para el `passenger` con el que está vinculada. Por eso la operación termina en `403`.

El frontend está expresando la intención de negocio; el backend todavía aplica una regla más restrictiva que no contempla la autogestión.

---

## 2. Modelo objetivo

El modelo se mantiene deliberadamente pequeño:

```text
DRIVER    = chofer
CLIENT    = cuenta/persona que accede a la aplicación
PASSENGER = persona física transportada
ADMIN     = rol técnico interno
```

`PASSENGER` es una entidad de negocio y puede no tener login propio. Cuando el passenger se autogestiona, también existe como `CLIENT`; no se crea un quinto rol.

### 2.1 Entidades

| Entidad de negocio | Responsabilidad | Persistencia actual |
|---|---|---|
| `passenger` | Persona transportada. Tiene chofer, rutas, viajes, resúmenes y estado de pago. | Tabla física `clients`. |
| `client` | Persona autenticada que accede y registra viajes para uno o más passengers. | Fila de `users` con el rol técnico actual `PASSENGER`. |
| `driver` | Persona que transporta y administra passengers asignados. | Fila de `users` con rol `DRIVER`. |
| `admin` | Rol técnico interno de compatibilidad. | Fila de `users` con rol `ADMIN`. |

### 2.2 Relación

```text
users (DRIVER)
  └── passenger.driver_id → passenger

users (CLIENT)
  └── client_passenger_access → passenger

passenger
  ├── routes
  ├── trips
  ├── summaries
  ├── billing configuration
  └── one or more clients with access
```

En el caso de autogestión:

```text
Una persona física
  ├── es passenger
  └── también es client
```

Siguen siendo dos registros relacionados. Compartir una misma cuenta entre varias personas queda fuera del modelo de permisos y es responsabilidad de esas personas.

---

## 3. Solución técnica sin cambiar la base de datos

### 3.1 Mapear el modelo Prisma al nombre físico existente

El modelo de aplicación puede usar nombres correctos aunque PostgreSQL conserve sus nombres actuales:

```prisma
model passenger {
  id             BigInt @id @default(autoincrement())
  nombre         String
  driver_id      BigInt?
  billing_cycle  BillingCycle
  // ...resto de campos y relaciones...

  @@map("clients")
}

enum Role {
  DRIVER
  ADMIN
  CLIENT @map("PASSENGER")
}
```

### 3.2 Mapeo explícito de la tabla puente

La tabla física `client_passengers` tiene hoy esta estructura:

```prisma
client_id  -> clients.id
user_id    -> users.id
```

Con el modelo de negocio corregido, esos campos significan:

```text
client_id = passenger_id semántico
user_id   = client_id semántico
```

El modelo Prisma debe hacer explícita esa traducción sin modificar PostgreSQL:

```prisma
model passenger_client_access {
  passenger_id BigInt @map("client_id")
  client_id    BigInt @map("user_id")
  added_at     DateTime @default(now()) @db.Timestamptz(6)

  passenger passenger @relation(fields: [passenger_id], references: [id], onDelete: Cascade)
  client    users     @relation(fields: [client_id], references: [id], onDelete: Cascade)

  @@id([passenger_id, client_id])
  @@index([client_id])
  @@map("client_passengers")
}
```

De esta forma, ningún servicio nuevo debería leer `client_passengers.client_id` pensando que es un client. En el código debe leer `passenger_client_access.passenger_id`; `@map("client_id")` se ocupa de conservar la columna física existente.

Resultado:

- El código trabaja con `passenger` y `Role.CLIENT`.
- La base de datos conserva la tabla `clients` y el valor `PASSENGER`.
- No se ejecuta una migración de datos.
- Los registros existentes siguen siendo válidos.

El mismo principio debe aplicarse a relaciones y columnas mediante `@map` cuando el nombre del código necesite diferir del nombre físico.

### 3.3 No renombrar físicamente en la primera etapa

No se recomienda renombrar ahora en PostgreSQL:

- Aumenta el riesgo de romper migraciones, consultas, fixtures y herramientas externas.
- No aporta una mejora funcional inmediata.
- La ambigüedad se puede resolver en Prisma, servicios y frontend.

Una migración física podría evaluarse más adelante, cuando no existan consumidores externos del schema antiguo.

---

## 4. Política de permisos objetivo

La autorización debe separarse en dos preguntas:

1. **¿Puede acceder al passenger?**
2. **¿Qué operación puede ejecutar sobre ese passenger?**

### 4.1 Alcance de acceso

| Actor | Acceso |
|---|---|
| `ADMIN` | Todos los passengers, por compatibilidad interna. |
| `DRIVER` | Passengers cuyo `driver_id` coincide con su usuario. |
| `CLIENT` autogestionado | Su propio passenger; client y passenger son la misma persona. |
| `CLIENT` delegado | Passengers relacionados mediante `client_passenger_access`. |
| Usuario desconocido | Ninguno. |

Solo existen tres roles de negocio: `DRIVER`, `CLIENT` y `PASSENGER`. `ADMIN` es un rol técnico interno. “Autogestionado” y “delegado” no son roles: son contextos calculados de la relación entre un `CLIENT` y un `PASSENGER`.

El rol `CLIENT` no es suficiente para decidir permisos. Primero hay que resolver la relación entre el client autenticado y el passenger:

```text
CLIENT + relación autogestionada
  passenger.auth_id === user.authId

CLIENT + relación delegada
  existe el vínculo client ↔ passenger,
  pero el client no es el passenger
```

La condición de autogestión debe utilizar el `auth_id` ya existente en la tabla física `clients`, que será expuesta semánticamente como `passenger.auth_id`. Esto está verificado en `prisma/schema.prisma:20`:

```prisma
auth_id String? @unique
```

También está contemplado por `verifyToken` (`src/middlewares/verifyToken.ts:48-60`), que busca un usuario autenticado en `clients.auth_id`. El campo es nullable y único: un `auth_id` puede pertenecer a como máximo un passenger, aunque varios passengers pueden tenerlo vacío.

El flujo de registro de autogestión debe guardar allí el mismo `auth_id` del usuario autenticado. Actualmente el código de registro escribe `users.auth_id`, pero no escribe `clients.auth_id`; por eso la detección de autogestión todavía no funciona de extremo a extremo. No hace falta agregar una columna ni cambiar la estructura.

### 4.2 Capacidades

| Capacidad | Admin | Driver | Client autogestionado | Client delegado |
|---|:---:|:---:|:---:|:---:|
| Ver passenger y su calendario | Sí | Sí, asignados | Sí | Sí, vinculados |
| Registrar viajes | Sí | Sí | Sí | Sí |
| Editar viajes | Sí | Sí | Sí, propio | No |
| Eliminar viajes | Sí | Sí | Sí, propio | No |
| Crear/editar rutas | Sí | Sí | Sí, propio | No |
| Administrar horarios | Sí | Sí | Sí, propio | No |
| Crear un passenger nuevo | Sí | Sí | No | No |
| Editar datos propios del passenger | Sí | Sí, asignados | Sí, propio | No |
| Cambiar `driver_id` o reasignar chofer | Sí | No, salvo política futura | No | No |
| Ver resúmenes | Sí | Sí | Sí | Sí |
| Administrar resúmenes | Sí | Sí | Sí, propio | No |
| Consultar estado de billing | Sí | Sí | Sí, propio | Sí, vinculado |
| Registrar/modificar pagos | Sí | Sí | Sí, propio | No, salvo flujo explícito de informar pago |

La diferencia no es un nuevo rol persistido: es una **condición de la relación**. María no necesita otro rol; es `CLIENT` y su relación con su propio passenger se detecta como autogestionada. Puede administrar sus propios datos operativos, pero no crea passengers adicionales ni cambia qué chofer está asignado.

### 4.3 Implementación recomendada

No usar `full` como sinónimo de “puede registrar viajes”. Mantener `full` para administración operativa y agregar una capacidad específica:

```ts
type PassengerCapabilities = {
  read: boolean;
  createTrips: boolean;
  editTrips: boolean;
  deleteTrips: boolean;
  manageRoutes: boolean;
  manageSchedules: boolean;
  manageBilling: boolean;
  createPassenger: boolean;
  editOwnPassengerProfile: boolean;
  assignDriver: boolean;
};
```

Ejemplo conceptual:

```ts
DRIVER                 -> read + createTrips + editTrips + deleteTrips + manageRoutes + ...
CLIENT autogestionado  -> todas las capacidades sobre su propio passenger
CLIENT delegado        -> read + createTrips
ADMIN                  -> todas las capacidades
```

Así el backend puede permitir a María registrar y administrar su propio passenger sin otorgar esos mismos permisos a un client delegado ni permisos de chofer sobre otros passengers.

---

## 5. Flujo corregido de una operación

### Client registra un viaje para un passenger

```text
1. Supabase valida el JWT.
2. `verifyToken` resuelve a María como `CLIENT`.
3. Se obtiene el `passenger_id` solicitado; en autogestión, es el passenger de María.
4. Se verifica la relación client ↔ passenger.
5. Se consulta la capacidad createTrips.
6. Si está permitida, se crea el viaje asociado al passenger.
7. El viaje, el resumen y el estado de pago quedan vinculados al passenger, no al usuario que lo registró.
```

El actor que registra el viaje no cambia quién es el titular del servicio: el viaje sigue perteneciendo al passenger.

### Driver administra un passenger

```text
1. Supabase valida el JWT.
2. verifyToken resuelve el usuario como DRIVER.
3. Se verifica passenger.driver_id === user.id.
4. Se consulta la capacidad solicitada.
5. Se permite la operación administrativa correspondiente.
```

### Client delegado accede a un passenger

El mismo flujo de relación se utiliza, pero `passenger.auth_id !== user.authId` o está vacío. El client puede ejecutar únicamente las capacidades delegadas; no hereda la administración completa del passenger.

La diferencia entre este caso y el de María no se resuelve creando otro rol. Se resuelve evaluando la relación concreta entre el usuario autenticado y el passenger solicitado.

---

## 6. Alcance de implementación

### Incluido

- Renombrar semánticamente el modelo Prisma `clients` a `passenger` usando `@@map("clients")`.
- Renombrar semánticamente `Role.PASSENGER` a `Role.CLIENT` usando `@map("PASSENGER")`.
- Renombrar helpers, tipos, variables y servicios para que hablen de `passenger` y `client` correctamente.
- Revisar el puente `client_passengers` y mapear sus campos sin alterar sus columnas físicas.
- Reemplazar el gate genérico de creación de viajes por la capacidad específica `createTrips`.
- Resolver el contexto autogestionado de un `CLIENT` a partir de `passenger.auth_id === user.authId` y poblar ese campo durante el registro de autogestión.
- Separar `createPassenger`, `editOwnPassengerProfile` y `assignDriver`; no tratar "crear/editar passenger" como una única capacidad.
- Alinear frontend y backend con el mismo contrato.
- Actualizar textos de UI: el registro administrado por el chofer debe referirse al passenger; la cuenta autenticada debe referirse al client.

### Fuera de alcance

- Renombrar tablas o enums físicamente en PostgreSQL.
- Mover columnas de billing.
- Crear nuevas tablas.
- Agregar nuevos roles persistidos o niveles de permiso entre clients delegados del mismo passenger.
- Resolver cuentas compartidas entre personas.

---

## 7. Checklist de aceptación

- [ ] La base de datos no tiene migraciones estructurales nuevas.
- [ ] El código distingue `passenger` (transportado) de `client` (cuenta).
- [ ] `Role.CLIENT` se persiste sobre el valor físico existente `PASSENGER`.
- [ ] Billing, viajes, rutas, resúmenes y `driver_id` siguen perteneciendo al passenger.
- [ ] Un client solo accede a passengers vinculados.
- [ ] Un client puede registrar viajes para un passenger vinculado.
- [ ] Un `CLIENT` autogestionado puede administrar su propio passenger.
- [ ] Un `CLIENT` delegado no obtiene automáticamente permisos de autogestión.
- [ ] Ningún client obtiene permisos de driver sobre otros passengers.
- [ ] Un passenger puede ser también client mediante dos registros vinculados.
- [ ] Admin permanece interno y no se expone como actor de producto.
- [ ] Frontend y backend usan la misma matriz de capacidades.

## Referencias

- `prisma/schema.prisma` — schema físico actual.
- `src/middlewares/verifyToken.ts` — resolución de identidad.
- `src/utils/calendarAuth.ts` — acceso actual por passenger.
- `src/modules/trips/service.ts` — creación de viajes y conflicto actual.
- `docs/CLIENTS_MODULE_PLAN.md` — evidencia de que `clients` representa hoy a la persona transportada.
- `C:\Users\Limon\Downloads\agendia-roles.md` — definición de producto.
