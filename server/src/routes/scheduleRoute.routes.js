import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  scheduleRouteCreateSchema,
  scheduleRouteStatusSchema,
  scheduleRouteRouteSchema,
  scheduleRoutePriceSchema,
  scheduleRouteIdParamSchema,
} from '../schemas/scheduleRoute.schema.js';
import {
  listPrices,
  assignPrice,
  updateStatus,
  updateRoute,
  updatePrice,
  deleteScheduleRoute,
} from '../controllers/scheduleRoute.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listPrices);
router.post('/', validate(scheduleRouteCreateSchema), requireRole('admin', 'operator'), assignPrice);
router.patch(
  '/:id/status',
  validate(scheduleRouteIdParamSchema, 'params'),
  validate(scheduleRouteStatusSchema),
  requireRole('admin'),
  updateStatus
);
router.patch(
  '/:id/route',
  validate(scheduleRouteIdParamSchema, 'params'),
  validate(scheduleRouteRouteSchema),
  requireRole('admin', 'operator'),
  updateRoute
);
router.patch(
  '/:id/price',
  validate(scheduleRouteIdParamSchema, 'params'),
  validate(scheduleRoutePriceSchema),
  requireRole('admin', 'operator'),
  updatePrice
);
router.delete(
  '/:id',
  validate(scheduleRouteIdParamSchema, 'params'),
  requireRole('admin', 'operator'),
  deleteScheduleRoute
);

export default router;