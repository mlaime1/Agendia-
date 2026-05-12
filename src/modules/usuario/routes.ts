import { Router } from 'express';
import { usuarioController } from './controller';

const router = Router();

router.get('/', usuarioController.list);
router.get('/:id', usuarioController.getById);
router.post('/', usuarioController.create);
router.put('/:id', usuarioController.update);
router.delete('/:id', usuarioController.remove);

export default router;