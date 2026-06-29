import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { upload } from '../controllers/attachment.controller.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.post('/me/avatar', authenticate, upload.single('avatar'), userController.uploadAvatar);

export default router;
