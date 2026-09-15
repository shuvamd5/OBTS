import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  locationCreateSchema,
  locationUpdateSchema,
  locationIdParamSchema,
} from '../schemas/location.schema.js';
import {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../controllers/location.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listLocations);
router.post('/', validate(locationCreateSchema), requireRole('admin'), createLocation);
router.patch(
  '/:id',
  validate(locationIdParamSchema, 'params'),
  validate(locationUpdateSchema),
  requireRole('admin'),
  updateLocation
);
router.delete('/:id', validate(locationIdParamSchema, 'params'), requireRole('admin'), deleteLocation);

export default router;