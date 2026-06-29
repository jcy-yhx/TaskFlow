import { createId } from '@paralleldrive/cuid2';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getPrisma, config } from '../config/index.js';
import { NotFoundError } from '../utils/errors.js';
import { getLogger } from '../config/index.js';

const prisma = getPrisma();
const logger = getLogger();
const UPLOAD_DIR = path.resolve(config.upload.dir);

// Ensure upload dir exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

export interface StoredFile {
  storageKey: string;
  originalName: string;
  size: number;
  mimeType: string;
}

/**
 * Save a file buffer to disk and return its metadata.
 * Phase 9 can swap this for S3 by implementing the same interface.
 */
export async function storeFile(
  file: Express.Multer.File,
  subDir: 'attachments' | 'avatars',
): Promise<StoredFile> {
  const dir = path.join(UPLOAD_DIR, subDir);
  await fs.mkdir(dir, { recursive: true });

  const ext = path.extname(file.originalname);
  const storageKey = `${subDir}/${createId()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storageKey);

  await fs.writeFile(filePath, file.buffer);

  logger.info({ storageKey, size: file.size }, 'File stored');
  return { storageKey, originalName: file.originalname, size: file.size, mimeType: file.mimetype };
}

/**
 * Read a file from disk. Returns buffer + mimeType, or null if not found.
 */
export async function readFile(storageKey: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const filePath = path.join(UPLOAD_DIR, storageKey);
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(storageKey).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf', '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain', '.csv': 'text/csv', '.zip': 'application/zip',
    };
    return { buffer, mimeType: mimeTypes[ext] ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}

export async function deleteFile(storageKey: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, storageKey));
  } catch { /* file already gone */ }
}

// ── Attachment records ──

export async function createAttachment(
  taskId: string,
  userId: string,
  file: Express.Multer.File,
) {
  const stored = await storeFile(file, 'attachments');

  return prisma.attachment.create({
    data: {
      taskId,
      userId,
      fileName: stored.originalName,
      fileSize: stored.size,
      mimeType: stored.mimeType,
      storageKey: stored.storageKey,
    },
  });
}

export async function listAttachments(taskId: string) {
  return prisma.attachment.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAttachment(id: string) {
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) throw new NotFoundError('Attachment');
  return att;
}

export async function deleteAttachment(id: string) {
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) throw new NotFoundError('Attachment');
  await deleteFile(att.storageKey);
  await prisma.attachment.delete({ where: { id } });
  return { message: 'Attachment deleted' };
}
