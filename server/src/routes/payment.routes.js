import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/env.js';
import {
  paymentCreateSchema,
  paymentCashSchema,
  paymentVerifySchema,
  paymentWebhookSchema,
  paymentIdParamSchema,
} from '../schemas/payment.schema.js';
import {
  createPayment,
  cashPayment,
  verifyPayment,
  paymentWebhook,
  refundPayment,
  getPayment,
} from '../controllers/payment.controller.js';

const router = Router();

// Online gateway endpoints are active only while the mock gateway flag is on
// (real merchant integration drops in behind the same contract later).
const mockGatewayOnly = (req, res, next) => {
  if (config.mockGateway) return next();
  return next(new AppError(404, 'Payment gateway not configured'));
};

router.post('/create', requireAuth, validate(paymentCreateSchema), createPayment);
router.post('/cash', requireAuth, requireRole('admin', 'operator'), validate(paymentCashSchema), cashPayment);
router.post('/verify', requireAuth, mockGatewayOnly, validate(paymentVerifySchema), verifyPayment);
router.post('/webhook', mockGatewayOnly, validate(paymentWebhookSchema), paymentWebhook);
router.post('/:id/refund', requireAuth, requireRole('admin'), validate(paymentIdParamSchema, 'params'), refundPayment);
router.get('/:id', requireAuth, validate(paymentIdParamSchema, 'params'), getPayment);

export default router;