import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  addrouteCreateSchema,
  addrouteStatusSchema,
  addrouteRouteSchema,
  addroutePriceSchema,
  addrouteIdParamSchema,
} from '../schemas/addroute.schema.js';
import {
  listPrices,
  assignPrice,
  updateStatus,
  updateRoute,
  updatePrice,
  deleteAddroute,
} from '../controllers/addroute.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listPrices);
router.post('/', validate(addrouteCreateSchema), requireRole('admin', 'operator'), assignPrice);
router.patch(
  '/:id/status',
  validate(addrouteIdParamSchema, 'params'),
  validate(addrouteStatusSchema),
  requireRole('admin'),
  updateStatus
);
router.patch(
  '/:id/route',
  validate(addrouteIdParamSchema, 'params'),
  validate(addrouteRouteSchema),
  requireRole('admin', 'operator'),
  updateRoute
);
router.patch(
  '/:id/price',
  validate(addrouteIdParamSchema, 'params'),
  validate(addroutePriceSchema),
  requireRole('admin', 'operator'),
  updatePrice
);
router.delete(
  '/:id',
  validate(addrouteIdParamSchema, 'params'),
  requireRole('admin', 'operator'),
  deleteAddroute
);

export default router;