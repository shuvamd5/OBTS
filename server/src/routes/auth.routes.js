import { Router } from 'express';
import { loginSchema, registerSchema, updateMeSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.schema.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { register, login, me, updateMe, refresh, logout, forgotPassword, resetPassword } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password/:token', validate(resetPasswordSchema), resetPassword);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, validate(updateMeSchema), updateMe);

export default router;