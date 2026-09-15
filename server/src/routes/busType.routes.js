import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  busTypeCreateSchema,
  busTypeUpdateSchema,
  busTypeIdParamSchema,
} from '../schemas/busType.schema.js';
import {
  listBusTypes,
  createBusType,
  updateBusType,
  deleteBusType,
} from '../controllers/busType.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listBusTypes);
router.post('/', validate(busTypeCreateSchema), requireRole('admin'), createBusType);
router.patch(
  '/:id',
  validate(busTypeIdParamSchema, 'params'),
  validate(busTypeUpdateSchema),
  requireRole('admin'),
  updateBusType
);
router.delete('/:id', validate(busTypeIdParamSchema, 'params'), requireRole('admin'), deleteBusType);

export default router;