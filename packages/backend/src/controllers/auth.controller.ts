import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { config } from '../config/index.js';

// ── Cookie helpers ──

const REFRESH_COOKIE = 'refresh_token';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: !config.isDev,  // only HTTPS in production
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: !config.isDev,
    sameSite: 'lax',
    path: '/api/auth',
  });
}

function getRefreshToken(req: Request): string | null {
  return req.cookies?.[REFRESH_COOKIE] ?? null;
}

// ── Handlers ──

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.register(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({
      data: { user: result.user, accessToken: result.accessToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    setRefreshCookie(res, result.refreshToken);
    res.json({
      data: { user: result.user, accessToken: result.accessToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getRefreshToken(req);
    if (!token) {
      res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'No refresh token provided' },
      });
      return;
    }
    const result = await authService.refreshTokens(token);
    setRefreshCookie(res, result.refreshToken);
    res.json({ data: { accessToken: result.accessToken } });
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getRefreshToken(req);
    if (token) {
      await authService.logout(token);
    }
    clearRefreshCookie(res);
    res.json({ data: { message: 'Logged out' } });
  } catch (err) {
    next(err);
  }
}

export async function oauthRedirect(req: Request, res: Response) {
  const provider = req.params.provider as 'google' | 'github';
  const cfg = config[provider];

  if (!cfg.clientId) {
    res.status(500).json({
      error: { code: 'CONFIG_ERROR', message: `${provider} OAuth is not configured` },
    });
    return;
  }

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.callbackUrl,
    response_type: 'code',
    scope: provider === 'google'
      ? 'openid email profile'
      : 'user:email',
  });

  const authUrl = provider === 'google'
    ? 'https://accounts.google.com/o/oauth2/v2/auth'
    : 'https://github.com/login/oauth/authorize';

  res.redirect(`${authUrl}?${params.toString()}`);
}

export async function oauthCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const provider = req.params.provider as 'google' | 'github';
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing authorization code' },
      });
      return;
    }

    // Exchange code for access token and fetch user profile
    const profile = await fetchOAuthProfile(provider, code);

    const result = await authService.oauthCallback(provider, profile.id, {
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });

    setRefreshCookie(res, result.refreshToken);

    // Redirect to frontend with tokens in URL
    const frontendUrl = new URL('/oauth/callback', config.frontendUrl);
    frontendUrl.searchParams.set('access_token', result.accessToken);
    frontendUrl.searchParams.set('user', JSON.stringify(result.user));
    res.redirect(frontendUrl.toString());
  } catch (err) {
    next(err);
  }
}

// ── OAuth Helper ──

interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

async function fetchOAuthProfile(
  provider: 'google' | 'github',
  code: string,
): Promise<OAuthProfile> {
  const cfg = config[provider];

  if (provider === 'google') {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json() as Record<string, unknown>;
    const accessToken = tokenData.access_token as string;

    // Fetch user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json() as Record<string, unknown>;

    return {
      id: userData.id as string,
      email: userData.email as string,
      name: userData.name as string,
      avatarUrl: userData.picture as string | undefined,
    };
  }

  // GitHub
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.callbackUrl,
    }),
  });
  const tokenData = await tokenRes.json() as Record<string, unknown>;
  const accessToken = tokenData.access_token as string;

  // Fetch user info
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'TaskFlow',
    },
  });
  const userData = await userRes.json() as Record<string, unknown>;

  // GitHub email may be private, fetch separately
  let email = userData.email as string;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'TaskFlow',
      },
    });
    const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean }>;
    const primary = emails.find((e) => e.primary);
    email = primary?.email ?? emails[0]?.email ?? '';
  }

  return {
    id: String(userData.id),
    email,
    name: (userData.name as string) ?? (userData.login as string),
    avatarUrl: userData.avatar_url as string | undefined,
  };
}
