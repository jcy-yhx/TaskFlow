import { createId } from '@paralleldrive/cuid2';
import { getPrisma, config } from '../config/index.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { ConflictError, UnauthenticatedError } from '../utils/errors.js';
import type { RegisterInput } from '@taskflow/shared';

const prisma = getPrisma();

function excludePasswordHash(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  passwordHash: string | null;
  [key: string]: unknown;
}) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ── Register ──
export async function register(input: RegisterInput) {
  const { email, password, name } = input;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  const tokens = await issueTokens(user.id);
  return { user: excludePasswordHash(user), ...tokens };
}

// ── Login ──
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthenticatedError('Invalid email or password');
  }

  if (!user.passwordHash) {
    throw new UnauthenticatedError(
      'This account uses OAuth. Please sign in with Google or GitHub.',
    );
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new UnauthenticatedError('Invalid email or password');
  }

  const tokens = await issueTokens(user.id);
  return { user: excludePasswordHash(user), ...tokens };
}

// ── Token Refresh ──
export async function refreshTokens(refreshTokenStr: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenStr);
  } catch {
    throw new UnauthenticatedError('Invalid or expired refresh token');
  }

  // Verify the token exists in the database
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenStr },
  });

  if (!stored) {
    // Token was already used — possible token rotation attack.
    // Revoke the entire family.
    await prisma.refreshToken.deleteMany({
      where: { family: payload.family },
    });
    throw new UnauthenticatedError('Token reused — family revoked');
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new UnauthenticatedError('Refresh token expired');
  }

  // Rotation: delete the used token and issue a new pair (same family)
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const tokens = await issueTokens(payload.sub, payload.family);
  return tokens;
}

// ── Logout ──
export async function logout(refreshTokenStr: string) {
  try {
    const payload = verifyRefreshToken(refreshTokenStr);
    // Delete the specific token
    await prisma.refreshToken.deleteMany({
      where: { token: refreshTokenStr },
    });
    return payload;
  } catch {
    // Token is invalid/expired — nothing to do
    return null;
  }
}

// ── OAuth callback ──
export async function oauthCallback(
  provider: 'google' | 'github',
  providerId: string,
  profile: { email: string; name: string; avatarUrl?: string },
) {
  const idField = provider === 'google' ? 'googleId' : 'githubId';

  // Try to find user by provider ID
  let user = await prisma.user.findFirst({
    where: { [idField]: providerId },
  });

  if (!user) {
    // Try to find by email and link the account
    const existingByEmail = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { [idField]: providerId, avatarUrl: profile.avatarUrl ?? existingByEmail.avatarUrl },
      });
    } else {
      // Create a new user
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          [idField]: providerId,
        },
      });
    }
  }

  const tokens = await issueTokens(user.id);
  return { user: excludePasswordHash(user), ...tokens };
}

// ── Helpers ──

/**
 * Issue a new access + refresh token pair.
 * Reuses the same family for token rotation; creates a new family for fresh logins.
 */
async function issueTokens(userId: string, family?: string) {
  const tokenFamily = family ?? createId();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true },
  });

  const refreshTokenId = createId();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, refreshTokenId, tokenFamily);

  await prisma.refreshToken.create({
    data: {
      id: refreshTokenId,
      userId,
      token: refreshToken,
      family: tokenFamily,
      expiresAt: new Date(Date.now() + parseExpiry(config.jwt.refreshExpiry)),
    },
  });

  return { accessToken, refreshToken };
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      googleId: true,
      githubId: true,
      createdAt: true,
    },
  });
}

// ── Internal ──

/** Parse a JWT-style expiry string (e.g. "15m", "7d") to milliseconds. */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback to 7d
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 3600 * 1000;
    case 'd': return num * 86400 * 1000;
    default: return 7 * 86400 * 1000;
  }
}
