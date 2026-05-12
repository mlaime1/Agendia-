import { createCrudController } from '../../utils/crud';
import { recorridoService } from './service';

export const recorridoController = createCrudController(recorridoService);