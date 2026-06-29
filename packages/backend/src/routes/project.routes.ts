import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireWorkspaceMembership, requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createProjectSchema, updateProjectSchema } from '@taskflow/shared';
import { getPrisma } from '../config/index.js';
import * as ctrl from '../controllers/project.controller.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

// Nested under /api/workspaces/:workspaceId/projects
router.post('/', requireWorkspaceMembership, requireRole('ADMIN'), validate(createProjectSchema), ctrl.create);
router.get('/', requireWorkspaceMembership, ctrl.list);

// Direct project access /api/projects/:projectId
// Look up workspace from the project for permission check
async function resolveProjectAccess(req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) {
  const projectId = req.params.projectId as string;
  if (!projectId) { next(); return; }
  const project = await getPrisma().project.findUnique({ where: { id: projectId } });
  if (!project) { next(); return; }
  // Set workspaceId param so requireWorkspaceMembership can read it
  req.params.workspaceId = project.workspaceId;
  next();
}

router.get('/:projectId', resolveProjectAccess, requireWorkspaceMembership, ctrl.getOne);
router.patch('/:projectId', resolveProjectAccess, requireWorkspaceMembership, requireRole('ADMIN'), validate(updateProjectSchema), ctrl.update);
router.delete('/:projectId', resolveProjectAccess, requireWorkspaceMembership, requireRole('ADMIN'), ctrl.remove);

export default router;
