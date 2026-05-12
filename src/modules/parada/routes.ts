import { Router } from 'express';
import { paradaController } from './controller';

const router = Router();

router.get('/', paradaController.list);
router.get('/:id', paradaController.getById);
router.post('/', paradaController.create);
router.put('/:id', paradaController.update);
router.delete('/:id', paradaController.remove);

export default router;