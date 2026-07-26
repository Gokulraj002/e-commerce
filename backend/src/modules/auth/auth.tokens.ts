import { createHash } from 'node:crypto';

import type { Role } from '@elite/shared';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';

/** JWT payload shape. `sub`/`role` MUST match middlewares/auth.ts expectations. */
export interface TokenPayload {
  sub: string;
  role: Role;
}

/** Sign a short-lived access token (verified by requireAuth). */
export function signAccessToken(payload: TokenPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

/** Sign a long-lived refresh token. */
export function signRefreshToken(payload: TokenPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

/** Verify a refresh token's signature; throws if invalid/expired. */
export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}

/**
 * Deterministic hash of a refresh token for at-rest storage & lookup.
 * The token itself is a signed high-entropy JWT, so SHA-256 is sufficient
 * and — unlike argon2 — lets us look rows up by the unique `tokenHash`.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Extract the absolute expiry from a signed token's `exp` claim. */
export function getTokenExpiry(token: string): Date {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return decoded?.exp ? new Date(decoded.exp * 1000) : new Date();
}
