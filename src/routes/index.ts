import { Router } from 'express';
import clientsRoutes from '../modules/clients/routes';
import usersRoutes from '../modules/users/routes';
import tripRoutes from '../modules/trips/routes';
import summaryRoutes from '../modules/summaries/routes';
import authRoutes from '../modules/auth/routes';
import invitationsRoutes from '../modules/invitations/routes';
import schedulesRoutes from '../modules/schedules/routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'OK' });
});

router.use('/clients', clientsRoutes);
router.use('/clients/:id/schedules', schedulesRoutes);
router.use('/auth', authRoutes)
router.use('/users', usersRoutes);
router.use('/trips', tripRoutes);
router.use('/summaries', summaryRoutes);
router.use('/invitations', invitationsRoutes);

export default router;