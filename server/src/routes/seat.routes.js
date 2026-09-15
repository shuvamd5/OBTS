import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bookingActionSchema } from '../schemas/booking.schema.js';
import { holdSeat, releaseSeat } from '../controllers/seat.controller.js';

const router = Router();

router.post('/hold', requireAuth, validate(bookingActionSchema), holdSeat);
router.post('/release', requireAuth, validate(bookingActionSchema), releaseSeat);

export default router;