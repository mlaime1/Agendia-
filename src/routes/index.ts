import { Router } from 'express';
import usuarioRoutes from '../modules/usuario/routes';
import clienteRoutes from '../modules/cliente/routes';
import recorridoRoutes from '../modules/recorrido/routes';
import paradaRoutes from '../modules/parada/routes';
import tarifaRoutes from '../modules/tarifa/routes';
import viajeRoutes from '../modules/viaje/routes';
import tripRoutes from '../modules/trips/routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'OK' });
});

/* router.use('/usuarios', usuarioRoutes);
router.use('/clientes', clienteRoutes);
router.use('/recorridos', recorridoRoutes);
router.use('/paradas', paradaRoutes);
router.use('/tarifas', tarifaRoutes);
router.use('/viajes', viajeRoutes); */
router.use('/trips', tripRoutes);

export default router;