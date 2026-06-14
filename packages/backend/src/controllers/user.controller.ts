import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';

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
