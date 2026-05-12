import { Router } from 'express';
import { viajeController } from './controller';

const router = Router();

router.get('/', viajeController.list);
router.get('/:id', viajeController.getById);
router.post('/', viajeController.create);
router.put('/:id', viajeController.update);
router.delete('/:id', viajeController.remove);

export default router;