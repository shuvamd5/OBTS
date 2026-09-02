import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getStats } from '../controllers/stats.controller.js';

const router = Router();

router.get('/', requireAuth, getStats);

export default router;