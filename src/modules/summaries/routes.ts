import { Router } from 'express'
import * as controller from './controller'

const router = Router()

// Crear
router.post('/', controller.createManual)                          // manual: body con period_start y period_end
router.post('/auto/:clientId', controller.createAuto)              // automático: calcula el período según config del cliente

// Preview — ver el período que se generaría antes de confirmar
router.get('/preview/:clientId', controller.preview)               // ?date=YYYY-MM-DD (opcional)

// Consultas
router.get('/client/:clientId', controller.getByClient)
router.get('/:id', controller.getById)
router.get('/:id/pdf', controller.getPdf)

// Mutaciones
router.patch('/:id/status', controller.updateStatus)
router.delete('/:id', controller.remove)

export default router