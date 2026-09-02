import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  busCreateSchema,
  busStatusSchema,
  busIdParamSchema,
} from '../schemas/bus.schema.js';
import { listBuses, createBus, updateStatus, deleteBus } from '../controllers/bus.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listBuses);
router.post('/', validate(busCreateSchema), requireRole('Admin', 'Manager'), createBus);
router.patch(
  '/:id/status',
  validate(busIdParamSchema, 'params'),
  validate(busStatusSchema),
  requireRole('Admin'),
  updateStatus
);
router.delete('/:id', validate(busIdParamSchema, 'params'), requireRole('Admin', 'Manager'), deleteBus);

export default router;