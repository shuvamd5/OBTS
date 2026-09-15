import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  busCreateSchema,
  busEditSchema,
  busStatusSchema,
  busOwnerSchema,
  busIdParamSchema,
} from '../schemas/bus.schema.js';
import {
  listBuses,
  getBus,
  createBus,
  updateBus,
  updateStatus,
  reassignOperator,
  deleteBus,
} from '../controllers/bus.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listBuses);
router.get('/:id', validate(busIdParamSchema, 'params'), getBus);
router.post('/', validate(busCreateSchema), requireRole('admin', 'operator'), createBus);
router.patch(
  '/:id/status',
  validate(busIdParamSchema, 'params'),
  validate(busStatusSchema),
  requireRole('admin'),
  updateStatus
);
router.patch(
  '/:id/operator',
  validate(busIdParamSchema, 'params'),
  validate(busOwnerSchema),
  requireRole('admin'),
  reassignOperator
);
router.patch(
  '/:id',
  validate(busIdParamSchema, 'params'),
  validate(busEditSchema),
  requireRole('admin', 'operator'),
  updateBus
);
router.delete('/:id', validate(busIdParamSchema, 'params'), requireRole('admin', 'operator'), deleteBus);

export default router;