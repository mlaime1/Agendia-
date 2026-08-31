import { Router } from 'express'
import * as controller from './controller'
import { verifyToken } from '../../middlewares/verifyToken'

const router = Router({ mergeParams: true })

router.use(verifyToken)

router.get('/', controller.getByClient)
router.post('/', controller.create)
router.put('/', controller.bulkReplace)
router.patch('/:schedId', controller.update)
router.delete('/:schedId', controller.remove)

export default router
