// src/modules/trips/routes.ts

import { Router } from 'express';
import { tripController } from './controller';
import { verifyToken } from '../../middlewares/verifyToken';

const router = Router();

router.use(verifyToken);

// Rutas generales
router.get('/', tripController.getAll);
router.post('/', tripController.create);

// Rutas por cliente (flujo principal de la app)
router.get('/client/:clientId', tripController.getByClient);
router.get('/client/:clientId/range', tripController.getByDateRange);
// Uso: GET /trips/client/1/range?from=2025-01-01&to=2025-01-31

router.get('/:id', tripController.getById);
router.patch('/:id', tripController.update);
router.delete('/:id', tripController.delete);

router.post('/:id/start', tripController.startTrip);
router.post('/:id/stops', tripController.addStop);
router.post('/:id/end', tripController.endTrip);

export default router;