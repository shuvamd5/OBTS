import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import Location from '../models/Location.js';
import { busMeta } from '../domain/busmeta.js';
import BusType from '../models/BusType.js';

const router = Router();

router.get(
  '/locations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const locations = await Location.find({}).sort({ name: 1 }).lean();
    res.json({ locations: locations.map((l) => l.name) });
  })
);

router.get('/bus-meta', requireAuth, (req, res) => {
  res.json(busMeta());
});

router.get(
  '/bus-types',
  asyncHandler(async (req, res) => {
    const busTypes = await BusType.find({ deletedAt: null })
      .sort({ seatCount: 1 })
      .select('name seatCount seatStyle')
      .lean();
    res.json({ busTypes });
  })
);

export default router;