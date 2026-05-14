import { Router } from 'express';
import clienteRoutes from '../modules/clients/routes';
import recorridoRoutes from '../modules/recorrido/routes';
import paradaRoutes from '../modules/parada/routes';
import usersRoutes from '../modules/users/routes';
import tripRoutes from '../modules/trips/routes';
import summaryRoutes from '../modules/summaries/routes';
import authRoutes from '../modules/auth/routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'OK' });
});

/* 
router.use('/clientes', clienteRoutes);
router.use('/recorridos', recorridoRoutes);
router.use('/paradas', paradaRoutes); */
router.use('/auth', authRoutes)
router.use('/users', usersRoutes);
router.use('/trips', tripRoutes);
router.use('/summaries', summaryRoutes);

export default router;