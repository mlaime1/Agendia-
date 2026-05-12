// src/modules/trips/routes.ts

import { Router } from 'express';
import { tripController } from './controller';

const router = Router();

// Rutas generales
router.get('/', tripController.getAll);
router.get('/:id', tripController.getById);
router.post('/', tripController.create);
router.patch('/:id', tripController.update);
router.delete('/:id', tripController.delete);

// Rutas por cliente (flujo principal de la app)
router.get('/client/:clientId', tripController.getByClient);
router.get('/client/:clientId/range', tripController.getByDateRange);
// Uso: GET /trips/client/1/range?from=2025-01-01&to=2025-01-31

export default router;