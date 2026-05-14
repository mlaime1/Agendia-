import { Router } from 'express'
import * as controller from './controller'

const router = Router()

router.get('/', controller.getAll)
router.get('/:id', controller.getById)
router.post('/', controller.create)
router.patch('/:id', controller.update)
router.patch('/:id/billing', controller.updateBillingConfig)  // panel de configuración
router.delete('/:id', controller.remove)

export default router