import type { Request, Response, NextFunction } from 'express';
import { taskQuerySchema } from '@taskflow/shared';
import { getIO } from '../config/index.js';
import * as taskService from '../services/task.service.js';

function tid(req: Request): string { return req.params.taskId as string; }
function pid(req: Request): string { return req.params.projectId as string; }

// ── Socket emitter helper ──
function emit(projectId: string, event: string, payload: Record<string, unknown>) {
  try {
    getIO().to(`project:${projectId}`).emit(event, payload);
  } catch { /* socket not initialized yet (startup) */ }
}

// ── CRUD ──

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = pid(req);
    const task = await taskService.createTask(projectId, req.user!.id, req.body);
    res.status(201).json({ data: task });
    emit(projectId, 'task:created', { task });
  } catch (err) { next(err); }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = taskQuerySchema.parse(req.query);
    const result = await taskService.listTasks(pid(req), query);
    res.json({ data: result.tasks, meta: result.meta });
  } catch (err) { next(err); }
}

export async function getByStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const grouped = await taskService.getTasksByStatus(pid(req));
    res.json({ data: grouped });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.getTask(tid(req));
    res.json({ data: task });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.updateTask(tid(req), req.body);
    res.json({ data: task });
    emit(task.projectId, 'task:updated', { task });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = tid(req);
    // Get task before deleting (needed for projectId in event)
    const task = await taskService.getTask(taskId);
    const projectId = task.projectId;
    const result = await taskService.deleteTask(taskId);
    res.json({ data: result });
    emit(projectId, 'task:deleted', { taskId, projectId });
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.updateTaskStatus(tid(req), req.body);
    res.json({ data: task });
    emit(task.projectId, 'task:moved', {
      taskId: task.id,
      projectId: task.projectId,
      status: task.status,
      position: task.position,
    });
  } catch (err) { next(err); }
}

export async function assignUser(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.assignUser(tid(req), req.body.userId);
    res.json({ data: task });
    emit(task.projectId, 'task:updated', { task });
  } catch (err) { next(err); }
}

export async function unassignUser(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.unassignUser(tid(req), req.params.userId as string);
    res.json({ data: task });
    emit(task.projectId, 'task:updated', { task });
  } catch (err) { next(err); }
}
