import swaggerJsdoc from 'swagger-jsdoc'

const swaggerDefinition: swaggerJsdoc.Options['definition'] = {
  openapi: '3.0.0',
  info: {
    title: 'Agendia API',
    version: '1.0.0',
    description: 'API de gestión de transporte de pasajeros con sistema de roles (chofer/pasajero) y códigos de invitación.',
  },
  servers: [
    { url: '/', description: 'Local' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', nullable: true },
          message: { type: 'string', nullable: true },
        },
      },
      RegisterDTO: {
        type: 'object',
        required: ['email', 'password', 'name', 'invitation_code'],
        properties: {
          email: { type: 'string', format: 'email', example: 'pasajero@mail.com' },
          password: { type: 'string', format: 'password', example: 'MiPass123!' },
          name: { type: 'string', example: 'Juan Pérez' },
          invitation_code: { type: 'string', example: 'A1B2C3D4', description: 'Código generado por un chofer' },
          phone: { type: 'string', example: '5411223344', description: 'Requerido si el código no tiene client asignado' },
        },
      },
      LoginDTO: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'chofer@mail.com' },
          password: { type: 'string', format: 'password', example: 'MiPass123!' },
        },
      },
      RefreshDTO: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string' },
        },
      },
      CreateClientDTO: {
        type: 'object',
        required: ['nombre', 'phone', 'billing_cycle'],
        properties: {
          nombre: { type: 'string', example: 'Carlos López' },
          phone: { type: 'string', example: '54115556677' },
          billing_cycle: { type: 'string', enum: ['weekly', 'biweekly', 'monthly'], example: 'monthly' },
          billing_day: { type: 'integer', example: 5, description: 'Día del mes (monthly) o día de semana 1-7 (weekly)' },
          billing_start_date: { type: 'string', format: 'date', example: '2025-01-01', description: 'Requerido para ciclo quincenal' },
        },
      },
      UpdateClientDTO: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          phone: { type: 'string' },
          billing_cycle: { type: 'string', enum: ['weekly', 'biweekly', 'monthly'] },
          billing_day: { type: 'integer', nullable: true },
          billing_start_date: { type: 'string', format: 'date', nullable: true },
        },
      },
      UpdateBillingConfigDTO: {
        type: 'object',
        required: ['billing_cycle'],
        properties: {
          billing_cycle: { type: 'string', enum: ['weekly', 'biweekly', 'monthly'] },
          billing_day: { type: 'integer', nullable: true },
          billing_start_date: { type: 'string', format: 'date', nullable: true },
        },
      },
      CreateTripDTO: {
        type: 'object',
        required: ['client_id', 'route_id', 'trip_date', 'trip_type'],
        properties: {
          client_id: { type: 'string', example: '5', description: 'ID del cliente/pasajero' },
          route_id: { type: 'string', example: '3' },
          rate_id: { type: 'string', example: '20', description: 'Opcional: auto-lookup si no se provee' },
          trip_date: { type: 'string', format: 'date-time', example: '2025-06-01T08:00:00' },
          trip_type: { type: 'string', enum: ['ida', 'ida y vuelta', 'especial'], example: 'ida' },
          final_price: { type: 'number', example: 5000, description: 'Opcional: se calcula de la tarifa si no se provee' },
          has_surcharge: { type: 'boolean', default: false },
          surcharge_reason: { type: 'string' },
          special_type: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      UpdateTripDTO: {
        type: 'object',
        properties: {
          trip_date: { type: 'string', format: 'date-time' },
          trip_type: { type: 'string', enum: ['ida', 'ida y vuelta', 'especial'] },
          final_price: { type: 'number' },
          has_surcharge: { type: 'boolean' },
          surcharge_reason: { type: 'string' },
          special_type: { type: 'string' },
          notes: { type: 'string' },
          route_id: { type: 'string' },
          rate_id: { type: 'string' },
        },
      },
      CreateSummaryDTO: {
        type: 'object',
        required: ['client_id', 'period_start', 'period_end'],
        properties: {
          client_id: { type: 'string', example: '5' },
          period_start: { type: 'string', format: 'date', example: '2025-01-01' },
          period_end: { type: 'string', format: 'date', example: '2025-01-31' },
          period_type: { type: 'string', default: 'manual' },
        },
      },
      UpdateSummaryStatusDTO: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['draft', 'sent', 'paid', 'archived'], example: 'sent' },
        },
      },
      CreateInvitationDTO: {
        type: 'object',
        properties: {
          client_id: { type: 'string', nullable: true, example: '42', description: 'null = nuevo cliente se creará al registrarse' },
        },
      },
    },
  },
  paths: {
    // ── Health ─────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Verificar estado del servidor',
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
          },
        },
      },
    },

    // ── Auth ───────────────────────────────────────────────────────
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registrar nuevo pasajero (requiere código de invitación)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterDTO' } } },
        },
        responses: {
          201: { description: 'Usuario creado + sesión' },
          400: { description: 'Código inválido o error de validación' },
          403: { description: 'Registro cerrado sin código' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginDTO' } } },
        },
        responses: {
          200: { description: 'Sesión iniciada' },
          401: { description: 'Credenciales inválidas' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar sesión (invalida refresh token)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Sesión cerrada' },
          401: { description: 'Token requerido' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refrescar token de acceso',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshDTO' } } },
        },
        responses: {
          200: { description: 'Nuevo token' },
          401: { description: 'Refresh token inválido' },
        },
      },
    },

    // ── Users ──────────────────────────────────────────────────────
    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Obtener perfil del usuario autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Perfil del usuario',
            content: {
              'application/json': {
                example: {
                  success: true,
                  data: {
                    id: '1', type: 'driver', name: 'Carlos', email: 'carlos@mail.com',
                    role: 'DRIVER', clients: [{ id: '5', nombre: 'Juan Pérez', driver_id: '1' }],
                  },
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Actualizar perfil del usuario autenticado',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, alias: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Perfil actualizado' } },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'Listar todos los usuarios (solo admin en el futuro)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista de usuarios' } },
      },
    },

    // ── Clients ────────────────────────────────────────────────────
    '/clients': {
      get: {
        tags: ['Clients'],
        summary: 'Listar todos los clientes',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista de clientes' } },
      },
      post: {
        tags: ['Clients'],
        summary: 'Crear un nuevo cliente (se asigna driver_id del token)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateClientDTO' } } },
        },
        responses: { 201: { description: 'Cliente creado' } },
      },
    },
    '/clients/{id}': {
      get: {
        tags: ['Clients'],
        summary: 'Obtener cliente por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Cliente encontrado' }, 404: { description: 'No encontrado' } },
      },
      patch: {
        tags: ['Clients'],
        summary: 'Actualizar un cliente',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateClientDTO' } } } },
        responses: { 200: { description: 'Cliente actualizado' } },
      },
      delete: {
        tags: ['Clients'],
        summary: 'Eliminar un cliente (sin summaries pendientes)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Cliente eliminado' }, 400: { description: 'Tiene summaries pendientes' } },
      },
    },
    '/clients/{id}/billing': {
      patch: {
        tags: ['Clients'],
        summary: 'Actualizar configuración de facturación de un cliente',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateBillingConfigDTO' } } } },
        responses: { 200: { description: 'Configuración actualizada' } },
      },
    },

    // ── Trips ──────────────────────────────────────────────────────
    '/trips': {
      get: {
        tags: ['Trips'],
        summary: 'Listar viajes (filtrados según rol del usuario)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista de viajes' } },
      },
      post: {
        tags: ['Trips'],
        summary: 'Crear un viaje (user_id se deriva del token)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTripDTO' } } },
        },
        responses: { 201: { description: 'Viaje creado' }, 403: { description: 'Sin permisos' } },
      },
    },
    '/trips/{id}': {
      get: {
        tags: ['Trips'],
        summary: 'Obtener un viaje por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Viaje encontrado' }, 404: { description: 'No encontrado' } },
      },
      patch: {
        tags: ['Trips'],
        summary: 'Actualizar un viaje',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateTripDTO' } } } },
        responses: { 200: { description: 'Viaje actualizado' }, 403: { description: 'Sin permisos de escritura' } },
      },
      delete: {
        tags: ['Trips'],
        summary: 'Eliminar un viaje',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Viaje eliminado' }, 403: { description: 'Sin permisos' } },
      },
    },
    '/trips/client/{clientId}': {
      get: {
        tags: ['Trips'],
        summary: 'Listar viajes de un cliente específico',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'clientId', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Lista de viajes del cliente' } },
      },
    },
    '/trips/client/{clientId}/range': {
      get: {
        tags: ['Trips'],
        summary: 'Listar viajes de un cliente en un rango de fechas',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'clientId', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'from', required: true, schema: { type: 'string', format: 'date' }, example: '2025-01-01' },
          { in: 'query', name: 'to', required: true, schema: { type: 'string', format: 'date' }, example: '2025-01-31' },
        ],
        responses: { 200: { description: 'Lista de viajes en el rango' } },
      },
    },

    // ── Summaries ──────────────────────────────────────────────────
    '/summaries': {
      post: {
        tags: ['Summaries'],
        summary: 'Crear resumen manual (período libre)',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSummaryDTO' } } } },
        responses: { 201: { description: 'Resumen creado' } },
      },
    },
    '/summaries/auto/{clientId}': {
      post: {
        tags: ['Summaries'],
        summary: 'Crear resumen automático según config de facturación del cliente',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'clientId', required: true, schema: { type: 'string' } }],
        responses: { 201: { description: 'Resumen creado' } },
      },
    },
    '/summaries/preview/{clientId}': {
      get: {
        tags: ['Summaries'],
        summary: 'Previsualizar período de facturación antes de generar',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'clientId', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'date', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Período calculado' } },
      },
    },
    '/summaries/client/{clientId}': {
      get: {
        tags: ['Summaries'],
        summary: 'Listar resúmenes de un cliente',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'clientId', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Lista de resúmenes' } },
      },
    },
    '/summaries/{id}': {
      get: {
        tags: ['Summaries'],
        summary: 'Obtener resumen por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Resumen encontrado' } },
      },
      delete: {
        tags: ['Summaries'],
        summary: 'Eliminar resumen (desvincula viajes)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Resumen eliminado' } },
      },
    },
    '/summaries/{id}/pdf': {
      get: {
        tags: ['Summaries'],
        summary: 'Descargar resumen en PDF',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Archivo PDF', content: { 'application/pdf': {} } } },
      },
    },
    '/summaries/{id}/status': {
      patch: {
        tags: ['Summaries'],
        summary: 'Cambiar estado del resumen (draft → sent → paid → archived)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateSummaryStatusDTO' } } } },
        responses: { 200: { description: 'Estado actualizado' } },
      },
    },

    // ── Invitations ───────────────────────────────────────────────
    '/invitations': {
      post: {
        tags: ['Invitations'],
        summary: 'Crear código de invitación (solo chofer)',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateInvitationDTO' } } } },
        responses: {
          201: {
            description: 'Código creado',
            content: {
              'application/json': {
                example: { success: true, data: { code: 'A1B2C3D4', expires_at: '2026-06-04T18:00:00Z' } },
              },
            },
          },
          403: { description: 'Solo choferes pueden crear códigos' },
        },
      },
      get: {
        tags: ['Invitations'],
        summary: 'Listar códigos de invitación del chofer autenticado',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista de códigos' } },
      },
    },
    '/invitations/{code}': {
      get: {
        tags: ['Invitations'],
        summary: 'Validar código de invitación (público, sin auth)',
        parameters: [{ in: 'path', name: 'code', required: true, schema: { type: 'string' }, example: 'A1B2C3D4' }],
        responses: {
          200: {
            description: 'Resultado de validación',
            content: {
              'application/json': {
                example: { success: true, data: { valid: true, client_id: null } },
              },
            },
          },
        },
      },
    },
  },
}

export const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: [],
})
