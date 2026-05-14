import { Router } from 'express'
import * as authController from './controller'
import { verifyToken } from '../../middlewares/verifyToken'

const router = Router()

router.post('/register', authController.register)
router.post('/login', authController.login)
router.post('/logout', verifyToken, authController.logout)
router.post('/refresh', authController.refresh)

export default router