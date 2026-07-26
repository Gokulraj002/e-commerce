/**
 * Automatic audit logging for admin mutations.
 *
 * Attach `auditMiddleware('<entity>')` to any staff-facing router so that every
 * non-GET request that completes with status < 400 is persisted to `audit_logs`.
 *
 * Example (integration — do NOT wire here; done in each staff router):
 *   import { auditMiddleware } from '../../middlewares/audit.js';
 *   productsRouter.use(requireAuth, requireStaff, auditMiddleware('products'));
 *
 * Design notes:
 *  • Runs on `res.on('finish')` so the request/response is never blocked.
 *  • Failures inside the audit write are logged via pino and swallowed — auditing
 *    must never break the business request.
 *  • GET requests (reads) are skipped by design; only mutations are audited.
 *  • Responses with status >= 400 are also skipped — failed mutations did not
 *    change state and would pollute the trail.
 *  • Request bodies are sanitised to strip credentials / tokens before storage.
 */
import type { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

/** Field names that must never be persisted to the audit trail. */
const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'confirmpassword',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'otp',
  'otpcode',
  'secret',
  'apikey',
  'authorization',
  'cvv',
  'cardnumber',
]);

/** Recursively drop sensitive keys from any object/array shape. Case-insensitive. */
function sanitize(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((v) => sanitize(v));
  if (typeof input !== 'object') return input;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = sanitize(value);
  }
  return out;
}

/**
 * Factory: returns middleware that audits mutations on the router it's attached to.
 * @param entity Logical entity name (e.g. 'products', 'orders', 'users').
 */
export function auditMiddleware(entity: string) {
  return function auditor(req: Request, res: Response, next: NextFunction): void {
    // Reads never get audited.
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }

    // Snapshot request state now — Express may mutate req later.
    const userId = req.user?.id;
    const action = req.method;
    const entityId = req.params?.id;
    const sanitizedBody = sanitize(req.body);
    const path = req.path;
    const ip = req.ip;

    res.on('finish', () => {
      // Skip failures — they didn't mutate state.
      if (res.statusCode >= 400) return;

      const changes: Prisma.InputJsonValue = {
        body: (sanitizedBody ?? null) as Prisma.InputJsonValue,
        path,
      };

      prisma.auditLog
        .create({
          data: {
            userId: userId ?? null,
            action,
            entity,
            entityId: entityId ?? null,
            changes,
            ip: ip ?? null,
          },
        })
        .catch((err: unknown) => {
          logger.error({ err, entity, action, path }, 'audit log write failed');
        });
    });

    next();
  };
}
