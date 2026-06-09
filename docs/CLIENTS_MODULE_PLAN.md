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

Ejemplo:

```text
Contrato de servicio

Facturación: Mensual

Días:
Lunes, Martes y Viernes

Horario:
07:30

Inicio:
01/06/2026

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

## Días de transporte

```text
☑ Lunes
☑ Martes
☑ Miércoles
☐ Jueves
☑ Viernes
☐ Sábado
☐ Domingo
```

Objetivo:

Definir los días habituales acordados con el cliente.

---

## Horarios acordados

Inicialmente:

```text
Hora de ida

07:30

Hora de vuelta

16:00
```

Objetivo:

Registrar horarios habituales para referencia del conductor.

No reemplazan la programación real de viajes.

---

# Revisión requerida en Backend

Actualmente existen:

```text
billing_cycle
billing_day
billing_start_date
```

Verificar si existen campos para almacenar:

* Días acordados de transporte
* Horario habitual de ida
* Horario habitual de vuelta

Probablemente NO existan actualmente.

---

# Posibles nuevas columnas

Opción simple para MVP:

```sql
transport_days JSONB

pickup_time TIME

return_time TIME
```

Ejemplo:

```json
["monday", "tuesday", "friday"]
```

---

# Objetivo de negocio

El contrato representa las condiciones habituales del servicio.

Incluye:

* Facturación
* Días acordados
* Horarios habituales

No reemplaza los viajes individuales del calendario.

Sirve como referencia operativa y administrativa para el conductor.
