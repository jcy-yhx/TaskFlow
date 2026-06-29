import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { getPrisma } from '../config/index.js';
import { storeFile, deleteFile } from '../services/attachment.service.js';

const prisma = getPrisma();

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getUserById(req.user!.id);
    if (!user) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' } });
      return;
    }

    // Delete old avatar if exists
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { avatarUrl: true } });
    if (user?.avatarUrl?.startsWith('/uploads/')) {
      await deleteFile(user.avatarUrl.replace('/uploads/', ''));
    }

    const stored = await storeFile(file, 'avatars');
    const avatarUrl = `/uploads/${stored.storageKey}`;

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl },
    });

    res.json({ data: { avatarUrl } });
  } catch (err) {
    next(err);
  }
}
