import { createCrudController } from '../../utils/crud';
import { clienteService } from './service';

export const clienteController = createCrudController(clienteService);