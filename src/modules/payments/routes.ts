import { Router } from 'express'
import { paymentController } from './controller'
import { verifyToken } from '../../middlewares/verifyToken'

const router = Router()

router.use(verifyToken)

router.get('/trip/:tripId', paymentController.getByTrip)
router.post('/trip/:tripId', paymentController.create)
router.patch('/:id', paymentController.update)
router.delete('/:id', paymentController.delete)

export default router
