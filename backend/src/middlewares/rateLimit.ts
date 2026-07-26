import type { Request } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

/**
 * Credential-facing auth limiter. 10 attempts per IP per 15 minutes is
 * generous for humans and punitive for credential-stuffing bots. Intended
 * for /auth/login and /auth/register.
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Try again later.',
    code: 'RATE_LIMITED',
  },
});

/**
 * Payments limiter. 30 req / min per IP covers gateway callbacks, retry loops,
 * and legitimate user flows while blunting abusive replay attempts against
 * /payments/*.
 */
export const paymentLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment requests. Try again later.',
    code: 'RATE_LIMITED',
  },
});

/**
 * Blanket write limiter for state-changing verbs — 60 req / min. Keyed by the
 * authenticated user when available so multiple users behind the same NAT
 * don't share a bucket, and falls back to remote address for pre-auth writes.
 * Read verbs are exempted so browsing the catalog doesn't drain the budget.
 */
export const writeLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => req.user?.id ?? req.ip ?? 'anonymous',
  skip: (req: Request): boolean =>
    req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: {
    success: false,
    message: 'Too many write requests. Slow down.',
    code: 'RATE_LIMITED',
  },
});
