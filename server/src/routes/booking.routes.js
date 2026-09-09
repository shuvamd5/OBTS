import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bookingSearchSchema, bookingActionSchema } from '../schemas/booking.schema.js';
import {
  searchOffers,
  createPendingBooking,
  createConfirmBooking,
} from '../controllers/booking.controller.js';

const router = Router();

// Public: search available rides + seat maps.
router.get('/search', validate(bookingSearchSchema, 'query'), searchOffers);

// Booking requires a logged-in user (legacy hides seat buttons for guests).
router.post('/pending', requireAuth, validate(bookingActionSchema), createPendingBooking);
router.post('/confirm', requireAuth, validate(bookingActionSchema), createConfirmBooking);

export default router;