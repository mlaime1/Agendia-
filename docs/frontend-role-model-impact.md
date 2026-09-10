# Impacto del modelo de roles en el frontend

**Resumen: no hay cambios obligatorios en el frontend.** El contrato HTTP quedó intacto. Este documento explica qué cambió del lado del backend y qué conviene revisar (todo opcional).

---

## 1. Qué se hizo en el backend

Se corrigió la ambigüedad del modelo de roles **sin tocar la base de datos**:

- El modelo Prisma `clients` pasó a llamarse `passenger` (persona transportada). La tabla física sigue siendo `clients`.
- El rol `PASSENGER` pasó a llamarse `CLIENT` (cuenta que accede a la app). El valor físico sigue siendo `PASSENGER`.
- La tabla puente `client_passengers` pasó a `passenger_client_access`.

Esto es **interno**. El objetivo era que el código hable de `passenger` (transportado) y `client` (cuenta) sin la confusión anterior.

### Modelo de roles (sin cambios de producto)

```text
DRIVER    = chofer
CLIENT    = persona con cuenta que accede y gestiona
PASSENGER = persona física transportada
ADMIN     = rol técnico interno
```

Un `passenger` puede autogestionarse y ser también `client`. No hay un quinto rol.

---

## 2. Qué NO cambió (contrato HTTP)

El frontend **no necesita cambios** en su consumo de la API:

- Las claves JSON siguen iguales: `client_id`, `clients`, `client`, `user_role`.
- Los endpoints y sus rutas no cambiaron.
- El rol de una cuenta de cliente sigue llegando como `"PASSENGER"` en `role` y `user_role`, y como `"passenger"` en `type`. Se preservó a propósito para no romper la app.

El backend agrega una capa de serialización para que los nombres internos nuevos no se filtren al JSON.

---

## 3. Cambio de comportamiento (esto sí importa)

**Antes:** el frontend habilitaba crear viajes para un `client` (`canCreateRegularTrips = isDriver || isClient`), pero el backend lo rechazaba con `403` porque exigía acceso `full`.

**Ahora:** un `client` vinculado a un passenger **puede registrar viajes** para ese passenger. Frontend y backend quedaron alineados.

### Permisos de un client

Un `client` tiene un único set de permisos (no hay distinción entre autogestionado y delegado):

| Capacidad | Client |
|---|:---:|
| Ver el calendario del passenger vinculado | Sí |
| Registrar viajes | Sí |
| Rutas y horarios | No |
| Ver resúmenes y estado de billing | Sí |
| Administrar billing | No |

El `client` **no** administra rutas, horarios ni configuración del passenger. Eso sigue siendo del chofer/admin.

---

## 4. Recomendaciones opcionales para el frontend

Ninguna es bloqueante:

1. **Naming interno.** Si el frontend tiene tipos o variables que llaman `passenger` a la cuenta o `client` a la persona transportada, conviene alinearlos al modelo de arriba.
2. **UI copy.** El registro administrado por el chofer debería referirse a la persona transportada como *pasajero*; la cuenta autenticada, como *cliente*.
3. **Roles.** Si en algún momento se quiere exponer el nombre nuevo `CLIENT` en la API, es un cambio coordinado y hay que acordarlo antes (hoy el wire mantiene `PASSENGER` por compatibilidad).

---

## 5. Cómo verificar

- Crear un viaje con un usuario `client` vinculado a un passenger → debe responder `201`, no `403`.
- Consultar el calendario y los viajes del passenger vinculado → debe seguir funcionando igual.
- Confirmar que las respuestas conservan las claves `client_id`, `clients` y `user_role`.
