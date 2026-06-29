import { getPrisma } from '../config/index.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateTaskInput, UpdateTaskInput, UpdateTaskStatusInput, TaskQueryInput } from '@taskflow/shared';

const prisma = getPrisma();

const TASK_INCLUDE = {
  assignees: {
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  },
  creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
  _count: { select: { comments: true, attachments: true } },
} as const;

function formatTask(task: Record<string, unknown>) {
  const t = task as {
    assignees: Array<Record<string, unknown>>;
    _count: { comments: number; attachments: number };
    id: string; projectId: string; title: string;
    status: string; priority: string; position: number;
    creatorId: string; createdAt: Date; updatedAt: Date;
    description: string | null; dueDate: Date | null;
    [k: string]: unknown;
  };
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    position: t.position,
    dueDate: t.dueDate,
    creatorId: t.creatorId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    assignees: t.assignees.map((a: Record<string, unknown>) => a.user),
    commentCount: t._count.comments,
    attachmentCount: t._count.attachments,
    creator: t.creator,
  };
}

// ── CRUD ──

export async function createTask(projectId: string, creatorId: string, input: CreateTaskInput) {
  // Calculate next position for the status column
  const maxPos = await prisma.task.aggregate({
    where: { projectId, status: input.status ?? 'TODO' },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const { assigneeIds, ...data } = input;

  const task = await prisma.task.create({
    data: {
      ...data,
      projectId,
      creatorId,
      position,
      assignees: assigneeIds?.length
        ? { create: assigneeIds.map((userId) => ({ userId })) }
        : undefined,
    },
    include: TASK_INCLUDE,
  });

  return formatTask(task);
}

export async function listTasks(projectId: string, query: TaskQueryInput) {
  const where: Record<string, unknown> = { projectId };
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.assignee) {
    where.assignees = { some: { userId: query.assignee } };
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: query.sort ? { [query.sort]: query.order } : { position: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    tasks: tasks.map(formatTask),
    meta: { total, page: query.page, pageSize: query.pageSize },
  };
}

export async function getTask(id: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: TASK_INCLUDE,
  });
  if (!task) throw new NotFoundError('Task');
  return formatTask(task);
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new NotFoundError('Task');
  const updated = await prisma.task.update({
    where: { id },
    data: input,
    include: TASK_INCLUDE,
  });
  return formatTask(updated);
}

export async function deleteTask(id: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new NotFoundError('Task');
  await prisma.task.delete({ where: { id } });
  return { message: 'Task deleted' };
}

// ── Status / Position (Kanban drag) ──

export async function updateTaskStatus(id: string, input: UpdateTaskStatusInput) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new NotFoundError('Task');

  const { status: newStatus, position: newPosition } = input;
  const oldStatus = task.status;
  const oldPosition = task.position;

  // No change
  if (oldStatus === newStatus && oldPosition === newPosition) {
    return getTask(id);
  }

  if (oldStatus === newStatus) {
    // Same column — reorder within
    if (newPosition > oldPosition) {
      // Moving down: shift tasks between old+1 and new position up by 1
      await prisma.task.updateMany({
        where: { projectId: task.projectId, status: oldStatus, position: { gt: oldPosition, lte: newPosition } },
        data: { position: { decrement: 1 } },
      });
    } else {
      // Moving up: shift tasks between new and old-1 down by 1
      await prisma.task.updateMany({
        where: { projectId: task.projectId, status: oldStatus, position: { gte: newPosition, lt: oldPosition } },
        data: { position: { increment: 1 } },
      });
    }
  } else {
    // Different column
    // Close gap in old column
    await prisma.task.updateMany({
      where: { projectId: task.projectId, status: oldStatus, position: { gt: oldPosition } },
      data: { position: { decrement: 1 } },
    });
    // Make room in new column
    await prisma.task.updateMany({
      where: { projectId: task.projectId, status: newStatus, position: { gte: newPosition } },
      data: { position: { increment: 1 } },
    });
  }

  // Update the moved task
  await prisma.task.update({
    where: { id },
    data: { status: newStatus, position: newPosition },
  });

  return getTask(id);
}

// ── Assignees ──

export async function assignUser(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError('Task');

  const existing = await prisma.taskAssignee.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (existing) return getTask(taskId);

  await prisma.taskAssignee.create({ data: { taskId, userId } });
  return getTask(taskId);
}

export async function unassignUser(taskId: string, userId: string) {
  await prisma.taskAssignee.deleteMany({ where: { taskId, userId } });
  return getTask(taskId);
}

// ── Batch: get all tasks for a project grouped by status (for Kanban) ──

export async function getTasksByStatus(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: TASK_INCLUDE,
    orderBy: { position: 'asc' },
  });

  const grouped: Record<string, Array<ReturnType<typeof formatTask>>> = {
    BACKLOG: [],
    TODO: [],
    IN_PROGRESS: [],
    IN_REVIEW: [],
    DONE: [],
  };

  for (const t of tasks) {
    const status = t.status as string;
    if (grouped[status]) {
      grouped[status].push(formatTask(t));
    }
  }

  return grouped;
}
