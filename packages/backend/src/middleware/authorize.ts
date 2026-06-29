import type { Request, Response, NextFunction } from 'express';
import { getPrisma } from '../config/index.js';
import { ForbiddenError, UnauthenticatedError } from '../utils/errors.js';

const ROLE_HIERARCHY: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

/**
 * Resolve the workspace ID from various param names, then check the user is a member.
 * Sets `req.workspaceMember` = { workspaceId, role } on success.
 */
export function requireWorkspaceMembership(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const userId = req.user?.id;
  if (!userId) { next(new UnauthenticatedError('Authentication required')); return; }

  // Try direct workspaceId param, or resolve from projectId
  const wsId = (req.params.id ?? req.params.workspaceId) as string | undefined;
  const pid = req.params.projectId as string | undefined;

  if (wsId) {
    checkMember(userId, wsId, req, next);
  } else if (pid) {
    // Resolve workspace from project
    getPrisma().project.findUnique({ where: { id: pid } })
      .then((p) => {
        if (!p) throw new ForbiddenError('Project not found');
        return checkMember(userId, p.workspaceId, req, next);
      })
      .catch(next);
  } else {
    next();
  }
}

async function checkMember(userId: string, workspaceId: string, req: Request, next: NextFunction) {
  const member = await getPrisma().workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!member) {
    throw new ForbiddenError('You are not a member of this workspace');
  }
  req.workspaceMember = { workspaceId, role: member.role };
  next();
}

/**
 * Factory: require minimum role. Must run after requireWorkspaceMembership.
 */
export function requireRole(minRole: string) {
  const minLevel = ROLE_HIERARCHY[minRole] ?? 0;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const member = req.workspaceMember;
    if (!member) {
      next(new ForbiddenError('Workspace membership required'));
      return;
    }
    const userLevel = ROLE_HIERARCHY[member.role] ?? 0;
    if (userLevel < minLevel) {
      next(new ForbiddenError(`This action requires at least ${minRole} role`));
      return;
    }
    next();
  };
}
