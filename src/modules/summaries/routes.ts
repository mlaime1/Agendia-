import { Router } from 'express';
import { tarifaController } from './controller';

const router = Router();

router.get('/', tarifaController.list);
router.get('/:id', tarifaController.getById);
router.post('/', tarifaController.create);
router.put('/:id', tarifaController.update);
router.delete('/:id', tarifaController.remove);

export default router;