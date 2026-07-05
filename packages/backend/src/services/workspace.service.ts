import { createId } from '@paralleldrive/cuid2';
import { getPrisma } from '../config/index.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import type { CreateWorkspaceInput, UpdateWorkspaceInput, CreateInvitationInput } from '@taskflow/shared';

const prisma = getPrisma();

// ── Slug ──
function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base, attempt = 0;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    attempt++;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

// ── Join code ──
function generateJoinCode(): string {
  return createId().slice(0, 8).toUpperCase();
}
async function ensureUniqueJoinCode(): Promise<string> {
  let code = generateJoinCode();
  while (await prisma.workspace.findUnique({ where: { joinCode: code } })) {
    code = generateJoinCode();
  }
  return code;
}

// ── CRUD ──

export async function createWorkspace(userId: string, input: CreateWorkspaceInput) {
  const slug = await ensureUniqueSlug(toSlug(input.name));
  const joinCode = await ensureUniqueJoinCode();

  const workspace = await prisma.workspace.create({
    data: {
      name: input.name,
      slug,
      joinCode,
      description: input.description,
      members: { create: { userId, role: 'OWNER' } },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
    },
  });
  return workspace;
}

export async function listWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: { include: { _count: { select: { projects: true, members: true } } } } },
    orderBy: { joinedAt: 'asc' },
  });
  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
    projectCount: m.workspace._count.projects,
    memberCount: m.workspace._count.members,
  }));
}

export async function getWorkspace(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!member) throw new ForbiddenError('You are not a member of this workspace');
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { _count: { select: { projects: true, members: true, invitations: true } } },
  });
  if (!workspace) throw new NotFoundError('Workspace');
  return { ...workspace, role: member.role };
}

export async function updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new NotFoundError('Workspace');
  const data: Record<string, unknown> = { ...input };
  if (input.name) data.slug = await ensureUniqueSlug(toSlug(input.name));
  return prisma.workspace.update({ where: { id: workspaceId }, data });
}

export async function deleteWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new NotFoundError('Workspace');
  return prisma.workspace.delete({ where: { id: workspaceId } });
}

// ── Join by code ──

export async function joinByCode(joinCode: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { joinCode: joinCode.toUpperCase() } });
  if (!workspace) throw new NotFoundError('Workspace not found with that invite code');

  // Check if already a member
  const existing = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
  });
  if (existing) throw new ConflictError('You are already a member of this workspace');

  await prisma.workspaceMember.create({
    data: { userId, workspaceId: workspace.id, role: 'MEMBER' },
  });

  return workspace;
}

export async function resetJoinCode(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new NotFoundError('Workspace');
  const joinCode = await ensureUniqueJoinCode();
  return prisma.workspace.update({ where: { id: workspaceId }, data: { joinCode } });
}

// ── Members ──

export async function listMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
  });
}

export async function updateMemberRole(workspaceId: string, targetUserId: string, newRole: 'ADMIN' | 'MEMBER', actorUserId: string) {
  const target = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: targetUserId, workspaceId } } });
  if (!target) throw new NotFoundError('Member');
  if (target.role === 'OWNER') throw new ForbiddenError('Cannot change the role of the workspace owner');
  if (newRole === 'ADMIN') {
    const actor = await prisma.workspaceMember.findUniqueOrThrow({ where: { userId_workspaceId: { userId: actorUserId, workspaceId } } });
    if (actor.role !== 'OWNER') throw new ForbiddenError('Only the owner can promote members to admin');
  }
  return prisma.workspaceMember.update({
    where: { id: target.id },
    data: { role: newRole },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });
}

export async function removeMember(workspaceId: string, targetUserId: string) {
  const target = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: targetUserId, workspaceId } } });
  if (!target) throw new NotFoundError('Member');
  if (target.role === 'OWNER') throw new ForbiddenError('Cannot remove the workspace owner');
  return prisma.workspaceMember.delete({ where: { id: target.id } });
}

// ── Invitations (email-based) ──

export async function createInvitation(workspaceId: string, inviterId: string, input: CreateInvitationInput) {
  const member = await prisma.user.findUnique({ where: { email: input.email } });
  if (member) {
    const existing = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: member.id, workspaceId } } });
    if (existing) throw new ConflictError('User is already a member of this workspace');
  }
  return prisma.invitation.create({
    data: { workspaceId, inviterId, email: input.email, token: createId(), role: input.role, expiresAt: new Date(Date.now() + 7 * 86400_000) },
  });
}

export async function listInvitations(workspaceId: string) {
  return prisma.invitation.findMany({
    where: { workspaceId, acceptedAt: null },
    include: { inviter: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) throw new NotFoundError('Invitation');
  if (invitation.acceptedAt) throw new ConflictError('This invitation has already been accepted');
  if (invitation.expiresAt < new Date()) throw new ForbiddenError('This invitation has expired');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  if (user.email !== invitation.email) throw new ForbiddenError('This invitation is for a different email address');

  await prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
  await prisma.workspaceMember.create({ data: { userId, workspaceId: invitation.workspaceId, role: invitation.role } });
  return prisma.workspace.findUniqueOrThrow({ where: { id: invitation.workspaceId } });
}
