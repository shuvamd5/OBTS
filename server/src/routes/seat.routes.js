import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { seatActionSchema } from '../schemas/booking.schema.js';
import { holdSeat, releaseSeat } from '../controllers/seat.controller.js';

const router = Router();

router.post('/hold', requireAuth, validate(seatActionSchema), holdSeat);
router.post('/release', requireAuth, validate(seatActionSchema), releaseSeat);

export default router;