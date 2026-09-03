# Flujo de pagos de summaries

Este documento describe los flujos independientes para mostrar summaries, informar un pago y registrar un pago real.

## Estados del summary

| Estado | Uso en la interfaz |
| --- | --- |
| `draft` | Borrador todavía no enviado |
| `sent` | Summary enviado, esperando el pago |
| `payment_reported` | El cliente o pasajero informó que pagó; estado informativo para destacar el aviso |
| `partial` | Se registró un pago, pero todavía queda saldo |
| `paid` | El total fue cubierto |
| `archived` | Summary archivado |

`pending` no es un estado de summary. Es un estado de pago de un viaje.

## Reglas principales

- El frontend no debe modificar estados financieros localmente como fuente de verdad.
- Los viajes normales con `payment_status = paid` no se incluyen al crear un summary nuevo.
- Los viajes `pending` y `partial` sí se incluyen.
- Un viaje que se paga después de haber sido incluido en un summary permanece vinculado a ese summary.
- `payment_reported` no registra dinero ni modifica viajes: es únicamente un estado informativo para destacar el aviso en el frontend.
- Este flujo no implementa notificaciones; el frontend puede usar el estado para destacar el aviso.
- Todos los endpoints requieren `Authorization: Bearer <token>`.

## Flujo del cliente o pasajero

### Informar que pagó un summary

```http
POST /summaries/{summaryId}/report-payment
Authorization: Bearer <token>
```

No requiere body.

Respuesta exitosa:

```json
{
  "success": true,
  "data": {
    "id": "123",
    "status": "payment_reported"
  }
}
```

Permisos:

- Un usuario `client` solo puede informar summaries de su propio cliente.
- Un usuario `PASSENGER` solo puede informar summaries de un cliente al que está vinculado.
- El summary debe estar en estado `sent`.
- Un reporte duplicado es rechazado.

Después de una respuesta exitosa, el frontend debe mostrar **Pago informado**. Este aviso no bloquea ni confirma el registro de un pago real.

## Flujo del chofer o administrador

### Confirmar un pago (alias compatible)

```http
POST /summaries/{summaryId}/confirm-payment
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "amount": 53500,
  "method": "transfer",
  "notes": "Pago recibido por transferencia"
}
```

`notes` es opcional. Los valores válidos para `method` son:

```text
cash | transfer | debit | credit | other
```

El monto debe ser positivo y no puede superar el saldo del summary.

Este endpoint es un alias compatible del flujo transaccional de pagos:

- Registra el pago.
- Distribuye el monto entre los viajes pendientes o parciales.
- Actualiza cada viaje a `partial` o `paid`.
- Actualiza el summary a `partial` o `paid`.

Permisos:

- El `DRIVER` debe ser el chofer propietario del cliente.
- `ADMIN` puede confirmar cualquier summary.
- Client y passenger no pueden confirmar.

El summary puede estar en estado `sent` o `payment_reported`; no es necesario que el cliente haya informado el pago antes.

### Registrar un pago directamente

El flujo principal para que un chofer o administrador registre un pago es:

```http
POST /summaries/{summaryId}/pay
Authorization: Bearer <token>
Content-Type: application/json
```

Usa el mismo body, permisos y reglas de monto que `confirm-payment`. Puede ejecutarse directamente desde `sent` o `payment_reported` y actualiza de forma transaccional los pagos, viajes y summary.

### Rechazar el reporte

```http
POST /summaries/{summaryId}/reject-payment
Authorization: Bearer <token>
```

No requiere body.

La respuesta cambia el summary de:

```text
payment_reported → sent
```

No crea pagos ni modifica los viajes.

Permisos:

- Solo el `DRIVER` propietario o `ADMIN` pueden rechazar.

## Registrar un pago individual de un viaje

Cuando corresponda registrar un pago real sobre un viaje específico:

```http
POST /payments/trip/{tripId}
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "amount": 4000,
  "method": "cash",
  "notes": "Pago del viaje"
}
```

El backend calcula el estado del viaje:

| `paid_amount` | `payment_status` |
| --- | --- |
| `0` | `pending` |
| Mayor que `0` y menor que el precio | `partial` |
| Igual o mayor que el precio | `paid` |

También existen:

```http
PATCH /payments/{paymentId}
DELETE /payments/{paymentId}
```

Editar o eliminar un pago recalcula el estado del viaje. Si el monto pagado vuelve a cero, el viaje vuelve a `pending`.

Estos endpoints registran un pago real. No deben utilizarse para simular el reporte de pago de un summary: para eso corresponde `report-payment`.

El backend permite la operación cuando el usuario tiene acceso completo al cliente asociado. El frontend debe mostrarla únicamente según los permisos y reglas de producto definidos para cada rol.

## Cambio genérico de estado

```http
PATCH /summaries/{summaryId}/status
Authorization: Bearer <token>
Content-Type: application/json
```

Body de ejemplo:

```json
{
  "status": "sent"
}
```

Este endpoint queda reservado para `DRIVER` propietario o `ADMIN` y solo debe utilizarse para estados de flujo generales como `draft`, `sent` o `archived`.

No usarlo para establecer:

```text
payment_reported
partial
paid
```

Esos estados deben alcanzarse mediante los endpoints específicos del flujo de pagos.

## Manejo recomendado en frontend

1. Mostrar el botón **Informar pago** únicamente para client/passenger cuando el summary esté `sent`.
2. Después de informar, refrescar el summary y mostrar **Pago informado**.
3. Para driver/admin, mostrar la acción de registrar pago desde `sent` o `payment_reported`. La acción de rechazar solo corresponde a un aviso en `payment_reported`.
4. Al registrar o confirmar, solicitar monto y método de pago.
5. Después de cualquier operación exitosa, usar la respuesta del backend o volver a consultar el summary.
6. No asumir que `payment_reported` significa que el dinero fue registrado.
7. Tratar errores `401` como sesión inválida y `403` como falta de permisos.

## Errores esperables

| HTTP | Situación |
| --- | --- |
| `400` | Estado incorrecto, monto inválido o transición no permitida |
| `401` | Token ausente o sesión no autenticada |
| `403` | Usuario sin acceso o rol no autorizado |
| `404` | Summary o viaje inexistente |

## Base de datos

Agregar `payment_reported` no requiere migración. El campo `summaries.status` es un `VARCHAR`; el cambio se implementa en los tipos, las transiciones y los endpoints del backend.
