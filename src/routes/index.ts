import { Router } from 'express';
import clientsRoutes from '../modules/clients/routes';
import usersRoutes from '../modules/users/routes';
import tripRoutes from '../modules/trips/routes';
import summaryRoutes from '../modules/summaries/routes';
import paymentRoutes from '../modules/payments/routes';
import authRoutes from '../modules/auth/routes';
import invitationsRoutes from '../modules/invitations/routes';
import schedulesRoutes from '../modules/schedules/routes';
import itineraryRoutes from '../modules/itinerary/routes';
import { prisma } from '../config/prisma';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ success: true, message: 'OK', database: 'up' });
  } catch {
    res.status(503).json({ success: true, message: 'OK', database: 'down' });
  }
});

router.use('/clients', clientsRoutes);
router.use('/clients/:id/schedules', schedulesRoutes);
router.use('/auth', authRoutes)
router.use('/users', usersRoutes);
router.use('/trips', tripRoutes);
router.use('/summaries', summaryRoutes);
router.use('/payments', paymentRoutes);
router.use('/invitations', invitationsRoutes);
router.use('/itineraries', itineraryRoutes);

export default router;