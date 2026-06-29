import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireWorkspaceMembership } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema } from '@taskflow/shared';
import { getPrisma } from '../config/index.js';
import * as ctrl from '../controllers/task.controller.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

// Nested under /api/projects/:projectId/tasks
router.post('/', requireWorkspaceMembership, validate(createTaskSchema), ctrl.create);
router.get('/', requireWorkspaceMembership, ctrl.list);
router.get('/by-status', requireWorkspaceMembership, ctrl.getByStatus);

// Direct task access /api/tasks/:taskId
async function resolveTaskProject(req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) {
  const taskId = req.params.taskId as string;
  if (!taskId) { next(); return; }
  const task = await getPrisma().task.findUnique({
    where: { id: taskId },
    select: { project: { select: { workspaceId: true } } },
  });
  if (task) {
    req.params.projectId = req.params.projectId ?? taskId;
    req.params.workspaceId = task.project.workspaceId;
  }
  next();
}

router.get('/:taskId', resolveTaskProject, requireWorkspaceMembership, ctrl.getOne);
router.patch('/:taskId', resolveTaskProject, requireWorkspaceMembership, validate(updateTaskSchema), ctrl.update);
router.delete('/:taskId', resolveTaskProject, requireWorkspaceMembership, ctrl.remove);
router.patch('/:taskId/status', resolveTaskProject, requireWorkspaceMembership, validate(updateTaskStatusSchema), ctrl.updateStatus);
router.post('/:taskId/assignees', resolveTaskProject, requireWorkspaceMembership, ctrl.assignUser);
router.delete('/:taskId/assignees/:userId', resolveTaskProject, requireWorkspaceMembership, ctrl.unassignUser);

export default router;
