import type { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/project.service.js';

function pid(req: Request): string { return req.params.projectId as string; }

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.createProject(req.params.workspaceId as string, req.body);
    res.status(201).json({ data: project });
  } catch (err) { next(err); }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const projects = await projectService.listProjects(req.params.workspaceId as string);
    // Enrich with task counts per status
    const enriched = projects.map((p) => {
      const counts: Record<string, number> = {};
      for (const t of p.tasks) {
        counts[t.status] = (counts[t.status] || 0) + 1;
      }
      const { tasks, ...rest } = p;
      return { ...rest, taskCount: p._count.tasks, statusCounts: counts };
    });
    res.json({ data: enriched });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.getProject(pid(req));
    res.json({ data: project });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.updateProject(pid(req), req.body);
    res.json({ data: project });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectService.deleteProject(pid(req));
    res.json({ data: result });
  } catch (err) { next(err); }
}
