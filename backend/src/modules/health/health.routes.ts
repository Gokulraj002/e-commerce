import { Router } from 'express';

import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { asyncHandler, ok } from '../../utils/http.js';

/**
 * Health module — the REFERENCE PATTERN every feature module follows:
 *   <name>.routes.ts      → Express Router (thin, wires paths → controller)
 *   <name>.controller.ts  → req/res only, delegates to service (no logic)
 *   <name>.service.ts     → business logic, throws ApiError
 *   <name>.repository.ts  → Prisma access only
 *   <name>.schema.ts      → Zod request schemas
 *   <name>.types.ts       → module-local types
 */
export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [db, cache] = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);
    return ok(res, {
      status: 'ok',
      db: db.status === 'fulfilled' ? 'up' : 'down',
      cache: cache.status === 'fulfilled' ? 'up' : 'down',
      time: new Date().toISOString(),
    });
  }),
);
