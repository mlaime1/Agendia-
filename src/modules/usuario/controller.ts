import { createCrudController } from '../../utils/crud';
import { usuarioService } from './service';

export const usuarioController = createCrudController(usuarioService);