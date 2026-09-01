import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import Location from '../models/Location.js';

const router = Router();

router.get(
  '/locations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const locations = await Location.find({}).sort({ name: 1 }).lean();
    res.json({ locations: locations.map((l) => l.name) });
  })
);

export default router;