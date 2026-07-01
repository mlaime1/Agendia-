# AgenDia - Módulo Clients (Driver)

## Objetivo

El módulo **Clients** será el lugar donde el conductor administra a las personas transportadas que tiene asignadas.

Cada Client representa una persona transportada y puede tener uno o varios usuarios con acceso a su información (familiares, cuidadores, tutores, etc.).

---

# Decisiones tomadas

## 1. Creación de Clients

### Situación actual

Actualmente los Clients se crean únicamente durante el proceso de registro mediante códigos de invitación.

### Nueva decisión

Se modificará el backend para permitir que un Driver pueda crear Clients directamente desde la aplicación.

Esto simplifica la gestión inicial y evita depender completamente del flujo de registro.

---

## 2. Listado de Clients

La pantalla principal mostrará:

* Buscador
* Lista de Clients asignados al Driver
* Botón "Nuevo Cliente"

### Acciones disponibles

#### Permitidas

* Ver detalle de Client
* Crear nuevo Client

#### No incluidas inicialmente

* Generar invitación para cuidador
* Gestionar responsables
* Historial completo
* Reportes

Estas acciones se realizarán desde el detalle del Client.

---

# Flujo de Nuevo Cliente

Desde la pantalla Clients:

```text
Clients
  |
  +-- Nuevo Cliente
```

Formulario inicial:

```text
Nombre
Teléfono
Dirección
Observaciones
```

Configuración de facturación:

```text
Facturación

○ Semanal
○ Quincenal
○ Mensual
```

Al guardar:

* Se crea el Client
* Se asocia automáticamente al Driver
* Queda disponible para comenzar a generar viajes

---

# Client Detail

## Decisión de UX

Se utilizará una pantalla completa.

No se utilizarán modales.

### Motivos

El detalle contiene demasiada información para un modal:

* Datos personales
* Facturación
* Responsables
* Viajes
* Historial futuro
* Configuración del servicio

Se reutilizará el mismo patrón visual de la pantalla "Mi Perfil".

---

## Estructura inicial del Detail

### Header

```text
← Cliente
```

### Hero

```text
Andrea Gómez

Cliente Activa
Facturación Mensual
```

---

### Datos Personales

```text
Nombre
Teléfono
Dirección
Observaciones
```

---

### Servicio

```text
Facturación
Mensual

Inicio de ciclo

Día de cierre
```

---

### Responsables

```text
María Gómez
Carlos Gómez

[ + Agregar Responsable ]
```

---

### Acciones

```text
Editar Cliente
```

---

### Estado

```text
Desactivar Cliente
```

---

# Gestión de Responsables

## Decisión principal

Los responsables NO se agregarán desde la pantalla de listado.

Se agregarán únicamente desde el detalle del Client.

### Flujo

```text
Client Detail
    |
    +-- Agregar Responsable
```

Esto mantiene el contexto y evita errores.

---

## Invitación de responsables

Desde el detalle:

```text
Usuarios con acceso

María Gómez
Carlos Gómez

[ + Agregar Responsable ]
```

Al seleccionar:

```text
Generar invitación
```

Se genera un código asociado al Client actual.

Cuando el usuario se registre:

* Se crea el User
* Se vincula al Client existente
* Obtiene acceso al calendario correspondiente

---

# Fase 1 (Implementación inmediata)

## Backend

* Permitir creación manual de Clients
* Endpoint crear Client
* Endpoint editar Client
* Endpoint obtener detalle de Client
* Endpoint listar Clients

## Frontend

* Pantalla Clients
* Buscador
* Lista de Clients
* Pantalla Nuevo Cliente
* Pantalla Client Detail
* Pantalla Editar Cliente

---

# Fase 2

## Responsables

* Generar invitación desde Client Detail
* Listado de responsables
* Vinculación de nuevos usuarios al Client

---

# Fase 3

## Mejoras futuras

* Historial completo de viajes
* Próximos viajes
* Resumen de facturación
* Reportes
* Gestión avanzada de responsables
* Notificaciones
* Archivos y documentación

---

# Principio de diseño acordado

El Driver piensa en:

```text
Clientes
```

No en:

```text
Códigos de invitación
```

Por lo tanto, la interfaz estará centrada en la gestión de Clients.

Los códigos de invitación serán un mecanismo interno para agregar responsables, no una funcionalidad principal visible desde el listado.


# Actualización del plan - Contrato de Servicio

## Nueva decisión

El contrato de servicio tendrá una pantalla propia.

No se editará directamente desde Client Detail.

## Decisión de modelo de datos (2026-06-08)

En lugar de columnas directas en la tabla `clients`, se crea una **tabla separada `service_schedules`** que permite múltiples horarios por día y por cliente.

Esto cubre casos reales como:

- **Ida y vuelta clásico**: Lunes 07:30 → 16:00
- **Solo ida**: Martes 09:00 (sin vuelta)
- **Múltiples viajes en un mismo día**: Martes con pickup a 12:50, 14:05 y 15:00

Ver [`SERVICE_SCHEDULES_PLAN.md`](./SERVICE_SCHEDULES_PLAN.md) para el detalle completo de backend (schema, endpoints, DTOs).

---

# Navegación

```text
Clients
    |
    +-- Client Detail
            |
            +-- Editar Cliente
            |
            +-- Editar Contrato
            |
            +-- Agregar Responsable
```

---

# Client Detail

Mostrará información resumida del contrato.

Ejemplo con horario simple:

```text
Contrato de servicio

Facturación: Mensual

Horarios:
Lunes    07:30 → 16:00
Martes   09:00
Viernes  08:15

Inicio:
01/06/2026

[ Editar contrato ]
```

Ejemplo con múltiples horarios por día:

```text
Contrato de servicio

Facturación: Semanal

Horarios:
Martes   12:50  Escuela
Martes   14:05  Depto
Martes   15:00  Escuela → Amoedo

[ Editar contrato ]
```

---

# Pantalla Editar Contrato

Responsable de toda la configuración operativa del servicio.

## Facturación

```text
○ Semanal
○ Quincenal
○ Mensual
```

Campos existentes:

```text
billing_cycle
billing_day
billing_start_date
```

---

## Horarios acordados

Cada horario es una fila independiente. El usuario puede agregar, editar y eliminar filas.

```text
┌─────────────────────────────────────────────────┐
│ Día         │ Ida     │ Vuelta   │ Etiqueta     │
├─────────────────────────────────────────────────┤
│ Lunes    ▾  │ 07:30   │ 16:00    │              │
│ Martes   ▾  │ 12:50   │ —        │ Escuela      │
│ Martes   ▾  │ 14:05   │ —        │ Depto        │
│ Martes   ▾  │ 15:00   │ —        │ Esc → Amoedo │
├─────────────────────────────────────────────────┤
│ [ + Agregar horario ]                           │
└─────────────────────────────────────────────────┘

[ Guardar cambios ]
```

- **Día**: dropdown con días de la semana (Lunes a Domingo).
- **Ida**: input de hora `HH:mm`, requerido.
- **Vuelta**: input de hora `HH:mm`, opcional (vacío = solo ida).
- **Etiqueta**: texto libre opcional para identificar el tramo.
- Cada fila tiene un botón para eliminar.
- El botón **"Guardar cambios"** envía todos los horarios en lote (endpoint `PUT` en lote, ver abajo).

Objetivo:

Registrar horarios habituales para referencia del conductor.

No reemplazan la programación real de viajes.

---

# Backend - Endpoints del contrato

| Método | Ruta | Uso en frontend |
|--------|------|-----------------|
| `GET` | `/clients/:id/schedules` | Cargar horarios en Client Detail y Editar Contrato |
| `POST` | `/clients/:id/schedules` | Agregar horario individual (opcional) |
| `PUT` | `/clients/:id/schedules` | Guardar todos los horarios en lote desde Editar Contrato |
| `PATCH` | `/clients/:id/schedules/:schedId` | Editar un horario individual |
| `DELETE` | `/clients/:id/schedules/:schedId` | Eliminar un horario individual |

El endpoint `PUT` recibe `{ schedules: [...] }` y reemplaza **todos** los horarios del cliente en una transacción. Es el endpoint principal para la pantalla Editar Contrato.

---

# Datos que expone el backend por cada horario

```ts
{
  id: number
  day_of_week: number       // 1=Lunes .. 7=Domingo
  pickup_time: string       // "HH:mm" (siempre presente)
  return_time: string|null  // "HH:mm" o null
  label: string|null        // etiqueta opcional
  is_active: boolean        // true por defecto
}
```

---

# Objetivo de negocio

El contrato representa las condiciones habituales del servicio.

Incluye:

* Facturación
* Horarios habituales (múltiples por día)

No reemplaza los viajes individuales del calendario.

Sirve como referencia operativa y administrativa para el conductor.
