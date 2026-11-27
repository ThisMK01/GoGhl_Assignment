import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { redis } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

export interface SessionData {
  sub: string;
  workspaces: Array<{ id: string; role: string }>;
}

const SESSION_COOKIE = 'sb_session';
const SESSION_TTL_SECONDS = 86400; // 24 hours
const STATE_TTL_SECONDS = 300; // 5 minutes

export const login = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  // 43-char base64url code_verifier + S256 code_challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('base64url');

  await redis.set(
    `oidc:state:${state}`,
    JSON.stringify({ code_verifier: codeVerifier }),
    'EX',
    STATE_TTL_SECONDS
  );

  const authUrl = new URL(`${config.oidc.issuer}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.oidc.clientId);
  authUrl.searchParams.set('redirect_uri', config.oidc.redirectUri);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'openid profile email workspaces');

  res.redirect(authUrl.toString());
});

export const callback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;

  if (!code || !state) {
    throw new AppError('Missing code or state', 400);
  }

  const stateKey = `oidc:state:${state}`;
  const storedRaw = await redis.get(stateKey);
  if (!storedRaw) {
    throw new AppError('Invalid or expired OIDC state', 400);
  }
  await redis.del(stateKey);

  const { code_verifier } = JSON.parse(storedRaw) as { code_verifier: string };

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.oidc.clientId,
    client_secret: config.oidc.clientSecret,
    code,
    redirect_uri: config.oidc.redirectUri,
    code_verifier,
  });

  const tokenRes = await fetch(`${config.oidc.issuer}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '');
    throw new AppError(`Token exchange failed: ${errText || tokenRes.status}`, 400);
  }

  const tokenJson = (await tokenRes.json()) as { id_token?: string };
  if (!tokenJson.id_token) {
    throw new AppError('Missing id_token in token response', 400);
  }

  const parts = tokenJson.id_token.split('.');
  if (parts.length < 2) {
    throw new AppError('Malformed id_token', 400);
  }

  const payload = JSON.parse(
    Buffer.from(parts[1], 'base64url').toString('utf8')
  ) as SessionData;

  if (!payload.sub || !Array.isArray(payload.workspaces)) {
    throw new AppError('Invalid id_token claims', 400);
  }

  const sessionId = crypto.randomUUID();
  const session: SessionData = {
    sub: payload.sub,
    workspaces: payload.workspaces,
  };

  await redis.set(`session:${sessionId}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);

  res.cookie(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });

  res.redirect(config.webOrigin);
});

export const me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (!sessionId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const raw = await redis.get(`session:${sessionId}`);
  if (!raw) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const session = JSON.parse(raw) as SessionData;
  res.status(200).json({ sub: session.sub, workspaces: session.workspaces });
});
