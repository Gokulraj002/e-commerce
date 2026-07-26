import { Redis } from 'ioredis';

import { env } from '../config/env.js';

/** Shared Redis connection for cache + rate-limit. BullMQ uses its own (see queues). */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
});

redis.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Redis error:', err.message);
});
