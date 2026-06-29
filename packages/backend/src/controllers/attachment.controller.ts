import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as attachmentService from '../services/attachment.service.js';

// Multer config: accept up to 5 files, 10MB each, common types only
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv', 'application/zip',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type ${file.mimetype} not allowed`));
  },
});

export async function uploadFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No files uploaded' } });
      return;
    }

    const attachments = await Promise.all(
      files.map((f) => attachmentService.createAttachment(req.params.taskId as string, req.user!.id, f)),
    );

    res.status(201).json({ data: attachments });
  } catch (err) { next(err); }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const attachments = await attachmentService.listAttachments(req.params.taskId as string);
    res.json({ data: attachments });
  } catch (err) { next(err); }
}

export async function download(req: Request, res: Response, next: NextFunction) {
  try {
    const att = await attachmentService.getAttachment(req.params.id as string);
    const file = await attachmentService.readFile(att.storageKey);

    if (!file) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found on disk' } });
      return;
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.fileName)}"`);
    res.setHeader('Content-Length', file.buffer.length);
    res.send(file.buffer);
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await attachmentService.deleteAttachment(req.params.id as string);
    res.json({ data: result });
  } catch (err) { next(err); }
}
