# Recuperación de contraseña

Contrato del backend para que un usuario que olvidó su contraseña vuelva a entrar.
El frontend todavía no tiene la pantalla; este documento es el handoff.

## Endpoint

```
POST /auth/password-recovery
Content-Type: application/json

{ "email": "usuario@mail.com" }
```

Público: **no** requiere `Authorization`.

| Código | Cuándo | Cuerpo |
| --- | --- | --- |
| `200` | Pedido aceptado (exista o no la cuenta) | `{ "success": true, "data": { "message": "Si el correo está registrado, te enviamos una contraseña temporal." } }` |
| `400` | Correo con formato inválido | `{ "success": false, "message": "Ingresá un correo electrónico válido" }` |
| `429` | Ya se pidió un restablecimiento para ese correo dentro del cooldown, o la IP superó su límite | `{ "success": false, "message": "Esperá unos minutos antes de volver a pedir el restablecimiento" }` |

El `200` es siempre el mismo texto: la respuesta **no** revela si el correo existe.
El `429` tampoco lo revela, porque ambos límites se aplican por correo y por IP
antes de buscar la cuenta, incluso para direcciones inexistentes.

## Qué pasa del lado del servidor

1. Normaliza el correo (trim + minúsculas) y valida el formato y el largo máximo
   (254 caracteres, el límite de dirección de correo).
2. Aplica dos límites en memoria antes de tocar la base:
   - por correo: un pedido cada `PASSWORD_RECOVERY_COOLDOWN_MINUTES` (10 por defecto);
   - por IP: `PASSWORD_RECOVERY_IP_REQUESTS_PER_HOUR` pedidos por hora (20 por defecto).
3. Busca el perfil en `users` por `email` (sin distinguir mayúsculas) y toma `auth_id`.
4. Genera una contraseña temporal de 12 caracteres con `crypto`:
   mayúscula + minúscula + dígito garantizados, sin caracteres ambiguos
   (`0/O`, `1/l/I`).
5. **Envía el mail primero.** Si el envío falla, no se toca el password actual:
   nadie queda bloqueado con una contraseña que nunca recibió. El límite por correo
   se libera para poder reintentar.
6. Aplica la temporal con `supabase.auth.admin.updateUserById(auth_id, { password })`.
   Reemplaza la contraseña anterior.
7. Si el paso 6 falla, se loguea y se libera el límite por correo; la respuesta sigue
   siendo el `200` genérico. El usuario ya recibió un mail con una contraseña que no
   quedó aplicada: es el caso menos malo, porque su contraseña anterior sigue válida.

## Flujo en la app

1. Pantalla "Olvidé mi contraseña": pide el correo y llama al endpoint.
2. Muestra el mensaje de la respuesta (no un "correo enviado", porque el backend no
   revela existencia).
3. El usuario recibe la temporal por mail y hace login normal con ella.
4. Ya logueado, entra a Perfil → Cambiar contraseña (`ChangePasswordScreen`, que usa
   `supabase.auth.updateUser({ password })`).

La "provisionalidad" es procedural: Supabase no tiene expiración de contraseñas. Si el
usuario nunca la cambia, la temporal sigue siendo válida hasta el próximo reset.

## Transporte de mail

`src/lib/mail.ts` envía por SMTP y **no tiene fallback**: el mail es el único canal de
entrega, así que sin configuración el envío falla en lugar de simular que salió. Esa
falla es la que protege el flujo: el servicio no reemplaza la contraseña con un valor
que nunca salió del servidor.

- **Con `SMTP_HOST`** → envío con `nodemailer` (timeouts de 10 s de conexión y 20 s de
  socket, y `requireTLS` obligatorio cuando hay credenciales y el puerto no es TLS
  directo).
- **Sin `SMTP_HOST`** → `AppError(500)` al intentar enviar, en cualquier entorno. El
  servicio lo loguea, no toca la contraseña actual y responde el `200` genérico.

Variables de entorno:

| Variable | Uso |
| --- | --- |
| `MAIL_FROM` | Remitente. Debe coincidir con el remitente verificado en el proveedor |
| `SMTP_HOST` | Host SMTP. **Obligatorio**: sin esto la recuperación no entrega |
| `SMTP_PORT` | Puerto, por defecto `587` |
| `SMTP_SECURE` | `true` para TLS directo (puerto 465) |
| `SMTP_USER` / `SMTP_PASS` | Credenciales del relay |
| `PASSWORD_RECOVERY_COOLDOWN_MINUTES` | Cooldown por correo, por defecto `10` |
| `PASSWORD_RECOVERY_IP_REQUESTS_PER_HOUR` | Pedidos por IP y por hora, por defecto `20` |

Opciones sin costo para entrega real: Gmail con app password (~500 mails/día) o un
plan free de Brevo (~300/día, verificando un remitente, sin dominio propio). El mailer
built-in de Supabase no sirve para esto: solo entrega a miembros de la organización del
proyecto y está pensado para los mails de Supabase Auth.

Para probar SMTP en local, el stack de Supabase levanta un catcher de mails
(Inbucket/Mailpit en el puerto `54324`): apuntá `SMTP_HOST=127.0.0.1` y
`SMTP_PORT=54325`, sin credenciales, y leé el mail en `http://127.0.0.1:54324`.

## Limitaciones conocidas

- Los límites viven en memoria: se pierden al reiniciar el proceso y no se comparten entre
  instancias. No hay tabla de auditoría de resets (se decidió no migrar). Al llenarse el
  registro (10 000 claves) se descarta la clave más vieja, nunca el mapa completo: vaciarlo
  devolvería el permiso a correos todavía bloqueados. El límite por IP es lo que impide
  llenar ese registro desde una sola conexión.
- Cualquiera que conozca el correo puede disparar un reset y forzar el cambio de la
  contraseña (efecto de bloqueo acotado: el dueño de la casilla recibe la temporal y el
  límite por correo evita el spam).
- No hay enforcement de "cambiar antes de usar": el backend no puede saber si la
  contraseña vigente es temporal. El paso 4 del flujo de la app es una convención.
- El tiempo de respuesta distingue levemente un correo registrado: el caso inexistente
  vuelve antes, el registrado espera al envío del mail y a Auth. Código y mensaje son
  idénticos.
- El correo se envía antes de aplicar la contraseña, así que un fallo de Auth deja al
  usuario con un mail inutilizable. Se prefiere eso a dejarlo sin ninguna contraseña.
