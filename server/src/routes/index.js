import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import routeRoutes from './route.routes.js';
import referenceRoutes from './reference.routes.js';
import busRoutes from './bus.routes.js';
import scheduleRoutes from './schedule.routes.js';
import addrouteRoutes from './addroute.routes.js';
import statsRoutes from './stats.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/routes', routeRoutes);
router.use('/reference', referenceRoutes);
router.use('/buses', busRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/prices', addrouteRoutes);
router.use('/stats', statsRoutes);

export default router;