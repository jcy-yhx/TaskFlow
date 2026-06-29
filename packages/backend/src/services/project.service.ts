import { getPrisma } from '../config/index.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateProjectInput, UpdateProjectInput } from '@taskflow/shared';

const prisma = getPrisma();

export async function createProject(workspaceId: string, input: CreateProjectInput) {
  return prisma.project.create({
    data: { workspaceId, name: input.name, description: input.description, color: input.color },
  });
}

export async function listProjects(workspaceId: string) {
  return prisma.project.findMany({
    where: { workspaceId },
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { _count: { select: { tasks: true } } },
  });
  if (!project) throw new NotFoundError('Project');
  return project;
}

export async function updateProject(id: string, input: UpdateProjectInput) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new NotFoundError('Project');
  return prisma.project.update({ where: { id }, data: input });
}

export async function deleteProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new NotFoundError('Project');
  await prisma.project.delete({ where: { id } });
  return { message: 'Project deleted' };
}
