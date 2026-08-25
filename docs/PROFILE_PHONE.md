# AgenDia - Teléfono en el perfil de usuario

## Objetivo

Permitir completar el perfil agregando/actualizando el **número de teléfono** del usuario.

## Decisión de diseño

El teléfono vive en **Supabase Auth** (`auth.users.phone`), que es el campo nativo propuesto por Supabase. Es la **fuente de verdad**:

* El backend se conecta con `service_role` (cliente en `src/lib/supabase.ts`), por lo que puede leer y actualizar ese campo sin pasar por RLS.
* No se agregó ninguna columna nueva en Prisma y no hay migraciones.
* `clients.phone` (contacto de negocio/WhatsApp del cliente) se mantiene **separado** y sin cambios.

## Cambios realizados

### 1. Registro (`src/modules/auth/service.ts`)

* Al crear el usuario con `supabase.auth.admin.createUser`, ahora se pasa `phone` (si viene en el `RegisterDTO`), previamente sanitizado.
* Aplica tanto a `registerDriver` como a `registerPassenger`.
* Se mantiene el guardado de `phone` en `clients.phone` durante el registro de pasajeros (dato de negocio).

### 2. Middleware `verifyToken` (`src/middlewares/verifyToken.ts`)

* `supabase.auth.getUser(token)` ya devuelve `user.phone` y `user.user_metadata.phone`.
* Se agrega `phone?: string` a `AuthRequest['user']` y se setea `req.user.phone` sin round-trips extra.

### 3. DTO (`src/modules/users/types.ts`)

* `UpdateUserDTO` ahora acepta `phone?: string`.

### 4. Controller (`src/modules/users/controller.ts`)

* `getMe` pasa `req.user.phone` al servicio.
* `updateMe` ahora pasa también `req.user.authId` al servicio.

### 5. Servicio de usuarios (`src/modules/users/service.ts`)

* **`getMe(authId, phone?)`**: incluye `phone` en la respuesta (para usuarios y para clients).
* **`updateMe(dbId, authId, role, dto)`**: si `role` es `'client'`, rechaza con 400 (los clientes no tienen fila en la tabla `users`). Si `dto.phone` viene definido:
  * Sanitiza el teléfono.
  * Llama `supabase.auth.admin.updateUserById(authId, { phone, phone_confirm: true })`.
    * `phone_confirm: true` evita el envío de SMS OTP (no hay proveedor SMS configurado).
    * Si Supabase devuelve error, se propaga como `AppError` (400).
  * El teléfono **no** se escribe en la tabla `users` de Prisma (no tiene columna); solo se actualiza en Auth.
  * Devuelve el teléfono actualizado en la respuesta.

### 6. Sanitización (`src/utils/phone.ts` - nuevo)

* `sanitizePhone(phone)` normaliza el teléfono: conserva `+` inicial si existe, quita espacios/guiones/paréntesis y valida entre 7 y 15 dígitos. Error → `AppError` 400.

## API resultante

### `PATCH /users/me`

Body:

```json
{
  "name": "Nombre",
  "alias": "Alias",
  "phone": "+54 9 11 2233-4455"
}
```

Respuesta (cuando se actualiza el teléfono):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Nombre",
    "email": "test@example.com",
    "alias": "Alias",
    "role": "DRIVER",
    "phone": "+5491122334455"
  }
}
```

### `GET /users/me`

Incluye `phone` (o `null` si no está cargado).

## Notas

* `PATCH /users/me` no está disponible para el rol `client` (viven en la tabla `clients`, no en `users`); se rechaza con 400.
* Si en el futuro se quiere login por SMS/OTP, la columna `auth.users.phone` ya queda lista.
* Para que el teléfono se sincronice con `clients.phone` (WhatsApp/negocio) haría falta migrar esa columna de `Decimal` a `String`; hoy se mantienen separados.
* RLS no afecta a estas operaciones: el backend usa `service_role` / conexión directa a Postgres.
