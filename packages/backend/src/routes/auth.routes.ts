import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '@taskflow/shared';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

// Local auth
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);

// OAuth — initiate
router.get('/oauth/:provider', authController.oauthRedirect);

// OAuth — callback (handled by the provider after user consents)
router.get('/oauth/:provider/callback', authController.oauthCallback);

export default router;
