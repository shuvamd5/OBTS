import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  scheduleCreateSchema,
  scheduleEditSchema,
  scheduleStatusSchema,
  scheduleIdParamSchema,
} from '../schemas/schedule.schema.js';
import {
  listSchedules,
  createSchedule,
  updateStatus,
  updateSchedule,
  deleteSchedule,
} from '../controllers/schedule.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listSchedules);
router.post('/', validate(scheduleCreateSchema), requireRole('Admin', 'Manager'), createSchedule);
router.patch(
  '/:id',
  validate(scheduleIdParamSchema, 'params'),
  validate(scheduleEditSchema),
  requireRole('Admin', 'Manager'),
  updateSchedule
);
router.patch(
  '/:id/status',
  validate(scheduleIdParamSchema, 'params'),
  validate(scheduleStatusSchema),
  requireRole('Admin'),
  updateStatus
);
router.delete(
  '/:id',
  validate(scheduleIdParamSchema, 'params'),
  requireRole('Admin', 'Manager'),
  deleteSchedule
);

export default router;