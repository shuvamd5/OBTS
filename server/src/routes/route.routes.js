import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  routeCreateSchema,
  routeEditSchema,
  checkpointCreateSchema,
  checkpointEditSchema,
  routeIdParamSchema,
  checkpointRouteIdParamSchema,
} from '../schemas/route.schema.js';
import {
  listRoutes,
  createRoute,
  updateRoute,
  addCheckpoint,
  updateCheckpoint,
  deleteRoute,
  deleteCheckpoint,
} from '../controllers/route.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listRoutes);
router.post('/', validate(routeCreateSchema), requireRole('Admin', 'Manager'), createRoute);
router.patch(
  '/:id',
  validate(routeIdParamSchema, 'params'),
  validate(routeEditSchema),
  requireRole('Admin', 'Manager'),
  updateRoute
);
router.post(
  '/:id/checkpoints',
  validate(routeIdParamSchema, 'params'),
  validate(checkpointCreateSchema),
  requireRole('Admin', 'Manager'),
  addCheckpoint
);
router.patch(
  '/:id/checkpoints/:cpid',
  validate(checkpointRouteIdParamSchema, 'params'),
  validate(checkpointEditSchema),
  requireRole('Admin', 'Manager'),
  updateCheckpoint
);
router.delete(
  '/:id',
  validate(routeIdParamSchema, 'params'),
  requireRole('Admin', 'Manager'),
  deleteRoute
);
router.delete(
  '/:id/checkpoints/:cpid',
  validate(checkpointRouteIdParamSchema, 'params'),
  requireRole('Admin', 'Manager'),
  deleteCheckpoint
);

export default router;