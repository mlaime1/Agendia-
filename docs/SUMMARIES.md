# Documentación del módulo Summaries (Resúmenes / Facturación)

## Propósito

El módulo **Summaries** permite agrupar viajes en períodos de facturación y generar un PDF de resumen/cobro. Soporta dos modalidades:

- **Resumen manual**: el chofer elige el rango de fechas libremente.
- **Resumen automático**: el sistema calcula el período según la configuración de facturación del cliente (semanal, quincenal, mensual).

Cada resumen puede estar parcialmente pagado, totalmente pagado o sin pagar.

---

## Estados de un Summary

| Estado | Significado | Transiciones posibles |
|--------|-------------|----------------------|
| `draft` | Borrador, aún no enviado | `sent`, `partial`, `paid` |
| `sent` | Enviado al cliente, pendiente de pago | `partial`, `paid` |
| `partial` | Algunos viajes o parte del total fueron pagos | `paid`, `sent` |
| `paid` | Totalmente abonado | `archived` |
| `archived` | Archivado, solo lectura | — |

> El estado `partial` se asigna **automáticamente** al crear un summary si alguno de sus viajes ya tiene pagos, o cuando se registra un pago parcial sobre el summary.

---

## Estados de pago de un Viaje

Cada viaje tiene su propio estado de pago independiente del summary:

| Estado | Significado |
|--------|-------------|
| `pending` | Sin pagos registrados |
| `partial` | Se pagó una parte, falta saldo |
| `paid` | Totalmente pagado |

Cuando un viaje se incluye en un summary, el summary acumula los `paid_amount` de todos sus viajes para calcular su propio estado.

---

## Flujo de uso (frontend)

### 1. Crear un resumen manual (uso más común para tu caso)

```http
POST /summaries
Authorization: Bearer <token>
Content-Type: application/json

{
  "client_id": "1",
  "driver_id": "1",
  "period_start": "2025-06-23",
  "period_end": "2025-06-23",
  "period_type": "manual",
  "notes": "Viajes del lunes"
}
```

**Reglas:**
- `period_type` es opcional. Si no se envía, usa `"manual"`.
- **No se exige** `billing_start_date` ni `billing_cycle` del cliente. Solo se usa el rango que mandás.
- Solo se incluyen viajes que:
  - Pertenezcan al `client_id`
  - Estén dentro del rango de fechas
  - Tengan `summary_id: null` (no estén en otro resumen)
- Si todos los viajes incluidos ya están pagos, el summary se crea con estado `paid`.
- Si algunos están pagos parcialmente, el summary se crea con estado `partial`.

### 2. Registrar pagos durante el día (por viaje)

Cuando el cliente abona un viaje en el momento, el chofer puede registrarlo:

```http
POST /payments/trip/{tripId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 5000,
  "method": "cash",
  "notes": "Abonó al bajar"
}
```

**Reglas:**
- `method`: `cash` | `transfer` | `debit` | `credit` | `other`
- **No se permite pagar más del `final_price` del viaje.** Si el viaje vale $5000 y ya se pagaron $3000, el máximo que se puede registrar es $2000.
- El sistema recalcula automáticamente `payment_status` del viaje.
- Se puede ver el historial de pagos de un viaje:
  ```http
  GET /payments/trip/{tripId}
  ```

### 3. Registrar pago global sobre un summary (liquidar saldo)

Al finalizar el día, si quedó un saldo pendiente, se puede registrar un pago sobre el resumen completo. El sistema distribuye el monto a los viajes pendientes en orden cronológico (FIFO):

```http
POST /summaries/{summaryId}/pay
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 2500,
  "method": "transfer",
  "notes": "Pago del viernes"
}
```

**Reglas:**
- El monto no puede exceder el saldo pendiente del summary (`total_amount - paid_amount`).
- Se distribuye primero al viaje más antiguo con estado `pending` o `partial`.
- Por cada viaque se cubre, se crea un registro en `payments` vinculado a ese viaje.
- Si el pago cubre el total del summary, su estado pasa a `paid` y se setea `paid_at`.

### 4. Descargar PDF

```http
GET /summaries/{summaryId}/pdf
Authorization: Bearer <token>
```

El PDF incluye:
- Badge con el estado (`Borrador`, `Enviado`, `Pago parcial`, `Abonado`, `Archivado`)
- Por cada día: tipo de viaje, cantidad, monto y **estado de pago** (`● Pagado`, `● Parcial`, `● Pendiente`)
- Sección **"Resumen de pagos"** con:
  - Total del período
  - Total pagado
  - Saldo pendiente (si aplica)
  - Métodos de pago utilizados
- Footer con total de viajes y monto total

### 5. Cambiar estado manualmente

```http
PATCH /summaries/{summaryId}/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "sent"
}
```

**Nota:** Cambiar a `sent`, `paid` o `archived` setea automáticamente las timestamps correspondientes (`sent_at`, `paid_at`, `archived_at`).

---

## Diferencia entre manual y automático

| | Manual | Automático |
|--|--------|------------|
| Endpoint | `POST /summaries` | `POST /summaries/auto/:clientId` |
| Rango de fechas | Lo define el usuario | Lo calcula el sistema |
| `period_type` | Libre (`manual`, etc.) | Viene del `billing_cycle` del cliente |
| Requiere `billing_start_date` | ❌ No | ✅ Sí, para quincenal |
| Preview disponible | No | `GET /summaries/preview/:clientId` |

---

## Modelo de datos relevante (para el frontend)

### Summary (resumen)
```ts
{
  id: string
  client_id: string
  driver_id: string
  period_start: Date
  period_end: Date
  period_type: string
  total_trips: number
  total_amount: number
  paid_amount: number
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'archived'
  sent_at?: Date
  paid_at?: Date
  archived_at?: Date
  trips: Trip[]
}
```

### Trip (viaje)
```ts
{
  id: string
  trip_date: Date
  trip_type: 'ida' | 'ida_y_vuelta' | 'especial'
  final_price: number
  payment_status: 'pending' | 'partial' | 'paid'
  paid_amount: number
  payments: Payment[]
}
```

### Payment (pago)
```ts
{
  id: string
  trip_id: string
  amount: number
  method: 'cash' | 'transfer' | 'debit' | 'credit' | 'other'
  paid_at: Date
  notes?: string
}
```

---

## Escenarios típicos

### Escenario A: 4 viajes en un día, pagos parciales
1. El chofer crea los 4 viajes con `POST /trips`.
2. Después de cada viaje (o al finalizar), registra pagos con `POST /payments/trip/:id`.
3. Al final del día, crea un summary manual del día: `POST /summaries` con `period_start` y `period_end` = hoy.
4. El summary se crea con estado `partial` (porque algunos viajes están pagos y otros no).
5. Al día siguiente, el cliente liquida el saldo: `POST /summaries/:id/pay`. El summary pasa a `paid`.

### Escenario B: Viaje de un solo día, pago inmediato
1. Se crea el viaje.
2. Se registra el pago completo: `POST /payments/trip/:id` con `amount = final_price`.
3. Se crea el summary manual. Como el viaje ya está `paid`, el summary se crea directamente en estado `paid`.

### Escenario C: Facturación semanal automática
1. El cliente tiene `billing_cycle: 'weekly'` y `billing_day: 1` (lunes).
2. El scheduler o el chofer usa `POST /summaries/auto/:clientId`.
3. El sistema calcula la semana cerrada más reciente y agrupa los viajes.

---

## Restricciones importantes

- **Un viaje solo puede estar en un summary a la vez.** Si un viaje ya fue incluido en un summary anterior (aunque sea borrador), no aparece disponible para uno nuevo.
- **No se permiten pagos mayores al precio del viaje.** El sistema rechaza el pago con error 400.
- **No se permiten pagos mayores al saldo del summary.** El sistema rechaza el pago con error 400.
- **Al eliminar un summary**, los viajes se desvinculan (`summary_id: null`) y quedan disponibles para ser facturados de nuevo.

---

## Notas para el frontend

- Mostrar en la UI de viajes el `payment_status` con colores: 🔴 Pendiente, 🟡 Parcial, 🟢 Pagado.
- En el listado de summaries, mostrar `paid_amount / total_amount` como barra de progreso.
- Antes de crear un summary manual, es útil consultar los viajes disponibles con `GET /trips/client/:clientId/range?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Los métodos de pago se muestran traducidos en el PDF: `cash` → Efectivo, `transfer` → Transferencia, etc.
