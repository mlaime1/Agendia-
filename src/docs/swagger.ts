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
        required: ['client_id', 'trip_date', 'trip_type'],
        properties: {
          client_id: { type: 'string', example: '5', description: 'ID del cliente/pasajero' },
          route_id: { type: 'string', example: '3', description: 'Requerido para ida/ida y vuelta. Ignorado para viajes especiales.' },
          rate_id: { type: 'string', example: '20', description: 'Opcional: auto-lookup si no se provee (solo para viajes con ruta)' },
          trip_date: { type: 'string', format: 'date-time', example: '2025-06-01T08:00:00' },
          trip_type: { type: 'string', enum: ['ida', 'ida y vuelta', 'especial'], example: 'ida' },
          final_price: { type: 'number', example: 5000, description: 'Requerido para viajes especiales. Override opcional para ida/ida y vuelta.' },
          has_surcharge: { type: 'boolean', default: false },
          surcharge_reason: { type: 'string' },
          special_type: { type: 'string', description: 'Solo aplica cuando trip_type es especial' },
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
          status: { type: 'string', enum: ['draft', 'sent', 'paid', 'partial', 'archived'], example: 'sent' },
        },
      },
      CreateSummaryPaymentDTO: {
        type: 'object',
        required: ['amount', 'method'],
        properties: {
          amount: { type: 'number', example: 2500, description: 'Monto a pagar sobre el resumen' },
          method: { type: 'string', enum: ['cash', 'transfer', 'debit', 'credit', 'other'], example: 'cash' },
          notes: { type: 'string', example: 'Pago del viernes' },
        },
      },
      CreatePaymentDTO: {
        type: 'object',
        required: ['amount', 'method'],
        properties: {
          amount: { type: 'number', example: 5000, description: 'Monto del pago' },
          method: { type: 'string', enum: ['cash', 'transfer', 'debit', 'credit', 'other'], example: 'cash' },
          notes: { type: 'string', example: 'Abonó en destino' },
        },
      },
      UpdatePaymentDTO: {
        type: 'object',
        properties: {
          amount: { type: 'number', example: 5000 },
          method: { type: 'string', enum: ['cash', 'transfer', 'debit', 'credit', 'other'] },
          notes: { type: 'string' },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '1' },
          trip_id: { type: 'string', example: '10' },
          amount: { type: 'number', example: 5000 },
          method: { type: 'string', example: 'cash' },
          paid_at: { type: 'string', format: 'date-time' },
          notes: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateInvitationDTO: {
        type: 'object',
        properties: {
          client_id: { type: 'string', nullable: true, example: '42', description: 'null = nuevo cliente se creará al registrarse' },
        },
      },
      CreateScheduleDTO: {
        type: 'object',
        required: ['day_of_week', 'pickup_time'],
        properties: {
          day_of_week: { type: 'integer', minimum: 1, maximum: 7, example: 1, description: '1=Lunes .. 7=Domingo' },
          pickup_time: { type: 'string', example: '07:30', description: 'Hora de ida en formato "HH:mm" (24h)' },
          return_time: { type: 'string', nullable: true, example: '16:00', description: 'Hora de vuelta en "HH:mm". null = solo ida' },
          label: { type: 'string', nullable: true, example: 'Escuela', description: 'Etiqueta libre, máximo 100 caracteres' },
          is_active: { type: 'boolean', default: true, description: 'Permite deshabilitar un horario sin eliminarlo' },
        },
      },
      UpdateScheduleDTO: {
        type: 'object',
        properties: {
          day_of_week: { type: 'integer', minimum: 1, maximum: 7 },
          pickup_time: { type: 'string', example: '08:00' },
          return_time: { type: 'string', nullable: true, example: null, description: 'null explícito = solo ida' },
          label: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
        },
      },
      BulkSchedulesDTO: {
        type: 'object',
        required: ['schedules'],
        properties: {
          schedules: {
            type: 'array',
            description: 'Lista completa de horarios. Reemplaza TODOS los existentes del cliente en una transacción.',
            items: { $ref: '#/components/schemas/CreateScheduleDTO' },
          },
        },
      },
      ServiceSchedule: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '1' },
          client_id: { type: 'string', example: '5' },
          day_of_week: { type: 'integer', example: 1 },
          pickup_time: { type: 'string', nullable: true, example: '07:30' },
          return_time: { type: 'string', nullable: true, example: '16:00' },
          label: { type: 'string', nullable: true, example: 'Escuela' },
          is_active: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateItineraryDTO: {
        type: 'object',
        required: ['name', 'client_id'],
        properties: {
          name: { type: 'string', example: 'Escuela a Casa' },
          client_id: { type: 'string', example: '5' },
        },
      },
      UpdateItineraryDTO: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
      CreateStopDTO: {
        type: 'object',
        required: ['address'],
        properties: {
          address: { type: 'string', example: 'Av. Corrientes 1234' },
          stop_order: { type: 'integer', example: 1 },
          lat: { type: 'number', example: -34.6037 },
          lng: { type: 'number', example: -58.3816 },
        },
      },
      UpdateStopDTO: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          stop_order: { type: 'integer' },
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
      },
      CreateRateDTO: {
        type: 'object',
        required: ['trip_type', 'base_price'],
        properties: {
          trip_type: { type: 'string', enum: ['ida', 'ida y vuelta', 'especial'], example: 'ida' },
          base_price: { type: 'number', example: 5000 },
          surcharge_price: { type: 'number', example: 1000 },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
        },
      },
      UpdateRateDTO: {
        type: 'object',
        properties: {
          base_price: { type: 'number' },
          surcharge_price: { type: 'number' },
          start_date: { type: 'string', format: 'date', nullable: true },
          end_date: { type: 'string', format: 'date', nullable: true },
        },
      },
      MatchRequestDTO: {
        type: 'object',
        required: ['client_id', 'points'],
        properties: {
          client_id: { type: 'string', example: '5' },
          points: {
            type: 'array',
            items: {
              type: 'object',
              required: ['lat', 'lng'],
              properties: {
                lat: { type: 'number' },
                lng: { type: 'number' },
              },
            },
          },
        },
      },
      StartTripDTO: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number', example: -34.6037 },
          lng: { type: 'number', example: -58.3816 },
        },
      },
      StopTripDTO: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number', example: -34.6037 },
          lng: { type: 'number', example: -58.3816 },
        },
      },
      EndTripDTO: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number', example: -34.6037 },
          lng: { type: 'number', example: -58.3816 },
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
        description: 'Requiere autenticación con Bearer token. Puede ser consultado por: el cliente dueño, un passenger asociado al cliente, el driver asignado al cliente, o un admin.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'clientId', required: true, schema: { type: 'string' }, description: 'ID del cliente' },
          { in: 'header', name: 'Authorization', required: true, schema: { type: 'string' }, example: 'Bearer <jwt_token>', description: 'Token JWT del usuario autenticado' },
        ],
        responses: {
          200: { description: 'Lista de resúmenes' },
          401: { description: 'Token no proporcionado o inválido' },
          403: { description: 'El usuario autenticado no tiene acceso a este cliente' },
        },
      },
    },
    '/summaries/{id}': {
      get: {
        tags: ['Summaries'],
        summary: 'Obtener resumen por ID',
        description: 'Requiere autenticación con Bearer token. El usuario solo puede ver el resumen si pertenece al cliente asociado (cliente dueño, passenger vinculado, driver asignado o admin).',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' }, description: 'ID del resumen' },
          { in: 'header', name: 'Authorization', required: true, schema: { type: 'string' }, example: 'Bearer <jwt_token>', description: 'Token JWT del usuario autenticado' },
        ],
        responses: {
          200: { description: 'Resumen encontrado' },
          401: { description: 'Token no proporcionado o inválido' },
          403: { description: 'El usuario autenticado no tiene acceso a este resumen' },
          404: { description: 'Resumen no encontrado' },
        },
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
        description: 'Requiere autenticación con Bearer token. El usuario solo puede descargar el PDF si pertenece al cliente asociado (cliente dueño, passenger vinculado, driver asignado o admin).',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' }, description: 'ID del resumen' },
          { in: 'header', name: 'Authorization', required: true, schema: { type: 'string' }, example: 'Bearer <jwt_token>', description: 'Token JWT del usuario autenticado' },
        ],
        responses: {
          200: { description: 'Archivo PDF', content: { 'application/pdf': {} } },
          401: { description: 'Token no proporcionado o inválido' },
          403: { description: 'El usuario autenticado no tiene acceso a este resumen' },
          404: { description: 'Resumen no encontrado' },
        },
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
    '/summaries/{id}/pay': {
      post: {
        tags: ['Summaries'],
        summary: 'Registrar pago global sobre un resumen (distribuye a viajes pendientes)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSummaryPaymentDTO' } } } },
        responses: { 200: { description: 'Pago registrado y resumen actualizado' }, 400: { description: 'Monto excede el saldo pendiente' } },
      },
    },
    '/payments/trip/{tripId}': {
      get: {
        tags: ['Payments'],
        summary: 'Listar pagos de un viaje',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'tripId', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Lista de pagos', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Payment' } } } } } },
      },
      post: {
        tags: ['Payments'],
        summary: 'Registrar un pago sobre un viaje',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'tripId', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePaymentDTO' } } } },
        responses: { 201: { description: 'Pago registrado' }, 400: { description: 'El pago excede el monto del viaje' } },
      },
    },
    '/payments/{id}': {
      patch: {
        tags: ['Payments'],
        summary: 'Editar un pago',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatePaymentDTO' } } } },
        responses: { 200: { description: 'Pago actualizado' } },
      },
      delete: {
        tags: ['Payments'],
        summary: 'Eliminar un pago (revierte el monto pagado del viaje)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Pago eliminado' } },
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

    // ── Schedules ─────────────────────────────────────────────────
    '/clients/{id}/schedules': {
      get: {
        tags: ['Schedules'],
        summary: 'Listar todos los horarios habituales de un cliente',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Lista de horarios ordenada por día y hora',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/ServiceSchedule' } },
                  },
                },
              },
            },
          },
          403: { description: 'El cliente no pertenece al usuario autenticado' },
        },
      },
      post: {
        tags: ['Schedules'],
        summary: 'Agregar un nuevo horario al cliente',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateScheduleDTO' } } },
        },
        responses: {
          201: {
            description: 'Horario creado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/ServiceSchedule' },
                  },
                },
              },
            },
          },
          400: { description: 'Datos inválidos (day_of_week fuera de rango, formato de hora incorrecto)' },
          403: { description: 'Sin permisos de escritura sobre el cliente' },
          409: { description: 'Ya existe un horario con ese día y hora' },
        },
      },
      put: {
        tags: ['Schedules'],
        summary: 'Reemplazar en lote todos los horarios del cliente (transaccional)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BulkSchedulesDTO' } } },
        },
        responses: {
          200: {
            description: 'Horarios reemplazados',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/ServiceSchedule' } },
                  },
                },
              },
            },
          },
          400: { description: 'Algún horario del lote es inválido' },
          403: { description: 'Sin permisos de escritura' },
        },
      },
    },
    '/clients/{id}/schedules/{schedId}': {
      patch: {
        tags: ['Schedules'],
        summary: 'Editar un horario existente (parcial)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'schedId', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateScheduleDTO' } } },
        },
        responses: {
          200: {
            description: 'Horario actualizado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/ServiceSchedule' },
                  },
                },
              },
            },
          },
          400: { description: 'Datos inválidos' },
          403: { description: 'Sin permisos de escritura' },
          404: { description: 'Horario no encontrado para este cliente' },
          409: { description: 'Ya existe un horario con ese día y hora' },
        },
      },
      delete: {
        tags: ['Schedules'],
        summary: 'Eliminar un horario',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'schedId', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Horario eliminado' },
          403: { description: 'Sin permisos de escritura' },
          404: { description: 'Horario no encontrado para este cliente' },
        },
      },
    },

    // ── Itineraries ───────────────────────────────────────────────
    '/itineraries': {
      get: {
        tags: ['Itineraries'],
        summary: 'Listar itinerarios (filtrados por rol)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista de itinerarios' } },
      },
      post: {
        tags: ['Itineraries'],
        summary: 'Crear un itinerario',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateItineraryDTO' } } },
        },
        responses: { 201: { description: 'Itinerario creado' }, 403: { description: 'Sin permisos' } },
      },
    },
    '/itineraries/{id}': {
      get: {
        tags: ['Itineraries'],
        summary: 'Obtener itinerario por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Itinerario encontrado' }, 404: { description: 'No encontrado' } },
      },
      patch: {
        tags: ['Itineraries'],
        summary: 'Actualizar un itinerario',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateItineraryDTO' } } } },
        responses: { 200: { description: 'Itinerario actualizado' }, 403: { description: 'Sin permisos' } },
      },
      delete: {
        tags: ['Itineraries'],
        summary: 'Eliminar un itinerario (sin viajes asociados)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Itinerario eliminado' }, 400: { description: 'Tiene viajes asociados' }, 403: { description: 'Sin permisos' } },
      },
    },
    '/itineraries/{id}/stops': {
      get: {
        tags: ['Itineraries'],
        summary: 'Listar paradas de un itinerario',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Lista de paradas' } },
      },
      post: {
        tags: ['Itineraries'],
        summary: 'Agregar una parada',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateStopDTO' } } },
        },
        responses: { 201: { description: 'Parada creada' }, 403: { description: 'Sin permisos' } },
      },
    },
    '/itineraries/{id}/stops/{stopId}': {
      patch: {
        tags: ['Itineraries'],
        summary: 'Editar una parada',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'stopId', required: true, schema: { type: 'string' } },
        ],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateStopDTO' } } } },
        responses: { 200: { description: 'Parada actualizada' }, 403: { description: 'Sin permisos' } },
      },
      delete: {
        tags: ['Itineraries'],
        summary: 'Eliminar una parada',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'stopId', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Parada eliminada' }, 403: { description: 'Sin permisos' } },
      },
    },
    '/itineraries/{id}/rates': {
      get: {
        tags: ['Itineraries'],
        summary: 'Listar tarifas de un itinerario',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Lista de tarifas' } },
      },
      post: {
        tags: ['Itineraries'],
        summary: 'Fijar tarifa (monto) para un itinerario',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRateDTO' } } },
        },
        responses: { 201: { description: 'Tarifa creada' }, 403: { description: 'Sin permisos' }, 409: { description: 'Ya existe tarifa para este tipo' } },
      },
    },
    '/itineraries/{id}/rates/{rateId}': {
      patch: {
        tags: ['Itineraries'],
        summary: 'Editar una tarifa',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'rateId', required: true, schema: { type: 'string' } },
        ],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateRateDTO' } } } },
        responses: { 200: { description: 'Tarifa actualizada' }, 403: { description: 'Sin permisos' } },
      },
      delete: {
        tags: ['Itineraries'],
        summary: 'Eliminar una tarifa',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'rateId', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Tarifa eliminada' }, 403: { description: 'Sin permisos' } },
      },
    },
    '/itineraries/match': {
      post: {
        tags: ['Itineraries'],
        summary: 'Encontrar itinerario más cercano a puntos GPS',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MatchRequestDTO' } } },
        },
        responses: {
          200: {
            description: 'Mejor match encontrado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        itinerary_id: { type: 'string' },
                        name: { type: 'string' },
                        distance_km: { type: 'number' },
                        rate: { type: 'object', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Trips (extended) ─────────────────────────────────────────
    '/trips/{id}/start': {
      post: {
        tags: ['Trips'],
        summary: 'Iniciar viaje (chofer marca recogida)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/StartTripDTO' } } },
        },
        responses: { 200: { description: 'Viaje iniciado' }, 403: { description: 'Sin permisos' } },
      },
    },
    '/trips/{id}/stops': {
      post: {
        tags: ['Trips'],
        summary: 'Marcar parada ad-hoc durante el viaje',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/StopTripDTO' } } },
        },
        responses: { 201: { description: 'Parada marcada' }, 403: { description: 'Sin permisos' } },
      },
    },
    '/trips/{id}/end': {
      post: {
        tags: ['Trips'],
        summary: 'Finalizar viaje (chofer marca entrega)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/EndTripDTO' } } },
        },
        responses: { 200: { description: 'Viaje finalizado' }, 403: { description: 'Sin permisos' } },
      },
    },
  },
}

export const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: [],
})
