import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import routeRoutes from './route.routes.js';
import referenceRoutes from './reference.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/routes', routeRoutes);
router.use('/reference', referenceRoutes);

export default router;