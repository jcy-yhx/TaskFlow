import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config/index.js';
import type { User } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  jti: string; // refresh token id (for revocation)
  family: string; // token family (for rotation detection)
}

/**
 * Sign an access token (short-lived, sent in Authorization header).
 */
export function signAccessToken(user: Pick<User, 'id' | 'email'>): string {
  const payload: AccessTokenPayload = { sub: user.id, email: user.email };
  const options: SignOptions = { expiresIn: config.jwt.accessExpiry as SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwt.accessSecret, options);
}

/**
 * Sign a refresh token (long-lived, stored in httpOnly cookie).
 * Contains jti (token ID) and family for rotation/revocation tracking.
 */
export function signRefreshToken(
  user: Pick<User, 'id'>,
  tokenId: string,
  family: string,
): string {
  const payload: RefreshTokenPayload = { sub: user.id, jti: tokenId, family };
  const options: SignOptions = { expiresIn: config.jwt.refreshExpiry as SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwt.refreshSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
}
