import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { roleSchema, userIdParamSchema, listQuerySchema } from '../schemas/user.schema.js';
import { listUsers, getUser, updateRole } from '../controllers/user.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', validate(listQuerySchema, 'query'), requireRole('admin', 'operator'), listUsers);
router.get('/:id', validate(userIdParamSchema, 'params'), getUser);
router.patch(
  '/:id/role',
  validate(userIdParamSchema, 'params'),
  validate(roleSchema),
  requireRole('admin'),
  updateRole
);

export default router;