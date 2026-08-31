import { Router } from 'express'
import { itineraryController } from './controller'
import { verifyToken } from '../../middlewares/verifyToken'

const router = Router()

router.use(verifyToken)

// Itineraries
router.get('/', itineraryController.getAll)
router.post('/', itineraryController.create)
router.get('/:id', itineraryController.getById)
router.patch('/:id', itineraryController.update)
router.delete('/:id', itineraryController.remove)

// Stops
router.get('/:id/stops', itineraryController.getStops)
router.post('/:id/stops', itineraryController.createStop)
router.patch('/:id/stops/:stopId', itineraryController.updateStop)
router.delete('/:id/stops/:stopId', itineraryController.removeStop)

// Rates
router.get('/:id/rates', itineraryController.getRates)
router.post('/:id/rates', itineraryController.createRate)
router.patch('/:id/rates/:rateId', itineraryController.updateRate)
router.delete('/:id/rates/:rateId', itineraryController.removeRate)

// Matching
router.post('/match', itineraryController.matchItinerary)

export default router
