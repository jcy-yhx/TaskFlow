import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireWorkspaceMembership, requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  createInvitationSchema,
  updateMemberRoleSchema,
} from '@taskflow/shared';
import * as ws from '../controllers/workspace.controller.js';

const router = Router();
router.use(authenticate);

// ── Join by code (public — no workspace membership needed) ──
router.post('/join', ws.joinByCode);

// ── Invitation acceptance (no workspace membership needed) ──
router.post('/invitations/:token/accept', ws.acceptInvitation);

// ── User's workspaces ──
router.post('/', validate(createWorkspaceSchema), ws.create);
router.get('/', ws.list);

// ── Single workspace (require membership) ──
router.get('/:id', requireWorkspaceMembership, ws.getOne);
router.patch('/:id', requireWorkspaceMembership, requireRole('ADMIN'), validate(updateWorkspaceSchema), ws.update);
router.delete('/:id', requireWorkspaceMembership, requireRole('OWNER'), ws.remove);

// ── Join code management ──
router.post('/:id/reset-join-code', requireWorkspaceMembership, requireRole('ADMIN'), ws.resetJoinCode);

// ── Members ──
router.get('/:id/members', requireWorkspaceMembership, ws.listMembers);
router.patch('/:id/members/:userId', requireWorkspaceMembership, requireRole('ADMIN'), validate(updateMemberRoleSchema), ws.updateMemberRole);
router.delete('/:id/members/:userId', requireWorkspaceMembership, requireRole('ADMIN'), ws.removeMember);

// ── Invitations ──
router.post('/:id/invitations', requireWorkspaceMembership, requireRole('ADMIN'), validate(createInvitationSchema), ws.createInvitation);
router.get('/:id/invitations', requireWorkspaceMembership, requireRole('ADMIN'), ws.listInvitations);

export default router;
