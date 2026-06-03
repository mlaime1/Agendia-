import { Router } from 'express'
import * as controller from './controller'
import { verifyToken } from '../../middlewares/verifyToken'
import { requireRole } from '../../middlewares/requireRole'

const router = Router()

router.post('/', verifyToken, requireRole('DRIVER'), controller.create)
router.get('/', verifyToken, requireRole('DRIVER'), controller.list)
router.get('/:code', controller.validateCode)

export default router
