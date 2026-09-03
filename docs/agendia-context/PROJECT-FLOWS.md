# AgenDia Backend — Architecture & Flows

## 1. Project Structure

El backend está desarrollado en **Express + TypeScript + Prisma**. La estructura de carpetas sigue el patrón de módulos por dominio, separación de lógica/controlador y tests:

```
src/
  config/           # Configuración de Prisma, env y utilidades globales
  modules/
    trips/          # Lógica y endpoints de viajes
    summaries/      # Resúmenes/períodos de cierre y abono
    users/          # Gestión de usuarios y clientes
    payments/       # Pagos y estados de viajes
    middlewares/    # Autenticación, control de acceso
    utils/          # Helpers de fechas, enums, otros
  routes/           # Router principal y routers de cada módulo
  app.ts            # Express wiring
  server.ts         # Entrada principal del backend
prisma/
  schema.prisma     # Definición de modelos y migraciones
  migrations/       # Migraciones de evolución del schema
  seed.ts           # Poblado de datos de ejemplo

docs/
  agendia-context/  # (Este doc) Documentación de arquitectura/flujo
  ...
```

## 2. Arquitectura General
- API REST (Express) + Middlewares
- ORM: Prisma conectado directo a Postgres (`src/config/prisma.ts`)
- Autenticación/Sesiones via Supabase Auth (usuarios y clientes)
- DataLayer: Todo acceso a datos es Prisma (no hay supabase.from desde el backend)
- Tipado/DTOs por tipos.ts en cada módulo
- Tests separados unit (mock de Prisma) vs integration (stack real, fuera de CI)

## 3. Flujos Principales

### 3.1 Creación de Viaje
**Ruta:** `POST /trips`

**Middleware:** Verifica token JWT (Supabase service key), resuelve usuario/rol y lo adjunta como `req.user`

**Controlador:** `src/modules/trips/controller.ts`
- Recibe datos: `{ client_id, driver_id, trip_date, ... }`
- Llama a `service.createTrip`

**Servicio:** `src/modules/trips/service.ts`
- Valida datos, chequea solapamiento o restricciones (“no se puede cargar viaje para fecha abonada/cerrada”)
- Si pasa, crea el registro en `trips`
- Retorna viaje creado o error

**Notas:**
- Esta validación es crítica para proteger períodos cerrados (abonos, cierre de mes, etc)
- El frontend puede bloquear fechas visualmente, pero esta lógica *siempre* vive en el backend

---

### 3.2 Cierre de Período / Abono (Resumen)
**Ruta:** `POST /summaries` (manual) o `/summaries/auto/:clientId` (automático)

**Controlador:** `src/modules/summaries/controller.ts` → `createManual` o `createAuto`

**Servicio:** `src/modules/summaries/service.ts` → `createSummaryManual` → `createSummary`
- Recibe `from`, `to`, IDs
- Calcula el período: el end date es **incluyente** (23:59:59.999)
- Busca viajes para ese cliente/driver cuyo `summary_id` sea null y `trip_date` ∈ [from, to]
- Genera el resumen, asigna `summary_id` a viajes incluidos
- Calcula total, pagos, status

---

### 3.3 Pago de Viaje o Periodo
- Pagos individuales: `POST /payments` (por viaje)
- Pagos de resumen: `POST /summaries/:id/pay`
- Ambos actualizan el status (paid, partial, pending) y los montos (paid_amount, final_price)

---

### 3.4 Consulta Manual/Automática de Estado
- `GET /trips` - todos, por filtros, rango de fechas, por cliente, etc
- `GET /summaries` - resumenes por cliente, periodo, etc

---

## 4. Reglas y Puntos Críticos
- **Data access SIEMPRE via Prisma** (Prohibido supabase.from, no depende de RLS)
- **Fechas:** Guardar y comparar SIEMPRE en UTC. El rango “to” en resúmenes incluye todo ese día (23:59:59.999)
- **Viajes no pueden crearse en fechas cerradas/abonadas:** la validación vive en el backend
- **summary_id en trips:** solo viajes sin summary_id pueden entrar a un resumen
- **El backend es la autoridad en reglas de dominio, el frontend sólo ayuda UX/UI**

---

## 5. Glossary (Glosario Rápido)
- **Trip**: Registro de viaje, con fecha, precio, estado, cliente, driver
- **Summary**: Agrupación de viajes en un período, resúmenes de cierre, pago, abono
- **Abonar**: Marcar el cierre de un período (resumen) como “archivado”/“pagado”/“cerrado”
- **Paid Amount/Status**: Dinero recibido y estado del viaje/resumen (pending, partial, paid)

---

## 6. Enums de Dominio

**Siempre usar los enums importados de @prisma/client, nunca strings literales.**

| Enum                | Valores                                |
|---------------------|----------------------------------------|
| payment_status_enum | pending, partial, paid                 |
| trip_type_enum      | ida, ida y vuelta, especial            |
| Role                | DRIVER, ADMIN, PASSENGER               |
| BillingCycle        | weekly, biweekly, monthly              |
| PeriodType          | weekly, biweekly, monthly, manual      |

Ejemplo de uso desde TypeScript:
```ts
import { payment_status_enum, trip_type_enum, Role } from '@prisma/client'

let status = payment_status_enum.paid
let tipo = trip_type_enum['ida y vuelta']
let rol = Role.ADMIN
```

---

## 7. TODO / Pendientes
- [ ] Documentar flujos de edición/cancelación de viajes
- [ ] Diagrama de secuencia para cierre automático mensual
- [ ] CRUD de entidades auxiliares (rutas, precios, localidades)

---

> Actualizar este doc cada vez que evoluciona el flujo real o cambia la arquitectura.