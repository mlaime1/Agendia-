import { createCrudController } from '../../utils/crud';
import { paradaService } from './service';

export const paradaController = createCrudController(paradaService);