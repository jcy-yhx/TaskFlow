import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthenticatedError } from '../utils/errors.js';

/**
 * JWT authentication middleware.
 * Expects header: Authorization: Bearer <token>
 * Attaches `req.user` = { id, email } on success.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Missing or malformed Authorization header');
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    throw new UnauthenticatedError('Invalid or expired access token');
  }
}
