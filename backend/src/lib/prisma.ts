import { PrismaClient } from '@prisma/client';

import { env } from '../config/env.js';

/** Singleton Prisma client. Import this everywhere — never `new PrismaClient()`. */
export const prisma = new PrismaClient({
  log: env.isProd ? ['error'] : ['warn', 'error'],
});
