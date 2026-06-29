import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireWorkspaceMembership } from '../middleware/authorize.js';
import { upload } from '../controllers/attachment.controller.js';
import * as ctrl from '../controllers/attachment.controller.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

// POST/GET /api/tasks/:taskId/attachments
router.post('/', requireWorkspaceMembership, upload.array('files', 5), ctrl.uploadFiles);
router.get('/', requireWorkspaceMembership, ctrl.list);

// GET/DELETE /api/attachments/:id
router.get('/:id/download', ctrl.download);
router.delete('/:id', ctrl.remove);

export default router;
