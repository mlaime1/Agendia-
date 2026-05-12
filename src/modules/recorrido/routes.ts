import { Router } from 'express';
import { recorridoController } from './controller';

const router = Router();

router.get('/', recorridoController.list);
router.get('/:id', recorridoController.getById);
router.post('/', recorridoController.create);
router.put('/:id', recorridoController.update);
router.delete('/:id', recorridoController.remove);

export default router;