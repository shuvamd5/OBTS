import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  bookingSearchSchema,
  bookingActionSchema,
  bookingIdParamSchema,
  ticketIdParamSchema,
} from '../schemas/booking.schema.js';
import {
  searchOffers,
  createPendingBooking,
  createConfirmBooking,
  listMyBookings,
  getBookingById,
  cancelBooking,
  cancelBookingTicket,
  listPassengers,
} from '../controllers/booking.controller.js';

const router = Router();

// Public: search available rides + seat maps.
router.get('/search', validate(bookingSearchSchema, 'query'), searchOffers);

// Booking requires a logged-in user (legacy hides seat buttons for guests).
router.post('/pending', requireAuth, validate(bookingActionSchema), createPendingBooking);
router.post('/confirm', requireAuth, validate(bookingActionSchema), createConfirmBooking);

// My bookings / staff passengers — static paths must come before /:id.
router.get('/my', requireAuth, listMyBookings);
router.get('/passengers', requireAuth, requireRole('admin', 'operator'), listPassengers);
router.patch(
  '/tickets/:ticketId/cancel',
  requireAuth,
  validate(ticketIdParamSchema, 'params'),
  cancelBookingTicket
);

// Booking group detail + cancel (owner only).
router.get('/:id', requireAuth, validate(bookingIdParamSchema, 'params'), getBookingById);
router.patch(
  '/:id/cancel',
  requireAuth,
  validate(bookingIdParamSchema, 'params'),
  cancelBooking
);

export default router;