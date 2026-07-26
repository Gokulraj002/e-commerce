import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';

import { authController } from './auth.controller.js';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), authController.register);
authRouter.post('/login', validate(loginSchema), authController.login);
authRouter.post('/refresh', validate(refreshSchema), authController.refresh);
authRouter.post('/logout', validate(logoutSchema), authController.logout);
authRouter.get('/me', requireAuth, authController.me);
