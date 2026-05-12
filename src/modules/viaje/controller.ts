import { createCrudController } from '../../utils/crud';
import { viajeService } from './service';

export const viajeController = createCrudController(viajeService);