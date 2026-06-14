import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

router.get('/me', authenticate, userController.getMe);

// Avatar upload — Phase 6
// router.post('/me/avatar', authenticate, upload.single('avatar'), userController.uploadAvatar);

export default router;
