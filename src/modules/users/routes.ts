import { Router } from 'express'
import * as usersController from './controller'
import { verifyToken } from '../../middlewares/verifyToken'

const router = Router()

// Todas las rutas requieren token
router.use(verifyToken)

router.get('/me', usersController.getMe)
router.patch('/me', usersController.updateMe)
router.get('/', usersController.getAll)  // solo admin en el futuro

export default router