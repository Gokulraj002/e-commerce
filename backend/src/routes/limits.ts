import type { RateLimitRequestHandler } from 'express-rate-limit';

import { authLimiter, paymentLimiter, writeLimiter } from '../middlewares/rateLimit.js';

export interface RouteLimiters {
  authLimiter: RateLimitRequestHandler;
  paymentLimiter: RateLimitRequestHandler;
  writeLimiter: RateLimitRequestHandler;
}

/**
 * Central accessor for the module-level rate limiters so route registries and
 * individual routers can wire them without importing from multiple locations.
 *
 * TODO(rate-limit-wire-up): `routes/index.ts` should consume this helper and
 * mount the limiters at the appropriate layers:
 *   - authRouter:     prepend `authLimiter` on POST /auth/login and /auth/register
 *   - paymentRouter:  prepend `paymentLimiter` on the /payments/* subtree
 *   - authenticated
 *     module routers: prepend `writeLimiter` after the requireAuth middleware
 *                     (writeLimiter itself skips read verbs) so req.user is
 *                     populated when its keyGenerator runs.
 * The registry edit is intentionally deferred in this pass to keep the security
 * hardening change self-contained and reversible.
 */
export function getLimiters(): RouteLimiters {
  return { authLimiter, paymentLimiter, writeLimiter };
}
