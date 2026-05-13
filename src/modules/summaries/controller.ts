import { createCrudController } from '../../utils/crud';
import { tarifaService } from './service';

export const tarifaController = createCrudController(tarifaService);