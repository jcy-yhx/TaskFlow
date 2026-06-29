import type { Request, Response, NextFunction } from 'express';
import { taskQuerySchema } from '@taskflow/shared';
import * as taskService from '../services/task.service.js';

function tid(req: Request): string { return req.params.taskId as string; }
function pid(req: Request): string { return req.params.projectId as string; }

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.createTask(pid(req), req.user!.id, req.body);
    res.status(201).json({ data: task });
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
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await taskService.deleteTask(tid(req));
    res.json({ data: result });
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.updateTaskStatus(tid(req), req.body);
    res.json({ data: task });
  } catch (err) { next(err); }
}

export async function assignUser(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.assignUser(tid(req), req.body.userId);
    res.json({ data: task });
  } catch (err) { next(err); }
}

export async function unassignUser(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.unassignUser(tid(req), req.params.userId as string);
    res.json({ data: task });
  } catch (err) { next(err); }
}
