import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from '../config/env.js';

/** BullMQ needs its own connection with maxRetriesPerRequest=null. */
export const queueConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/** Central queue names — reference these, never raw strings. */
export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  DELIVERY_ASSIGN: 'delivery-assign',
  INVOICE: 'invoice',
  REPORTS: 'reports',
} as const;

const registry = new Map<string, Queue>();

/** Get-or-create a shared Queue instance by name. */
export function getQueue(name: string): Queue {
  if (!registry.has(name)) {
    registry.set(name, new Queue(name, { connection: queueConnection }));
  }
  return registry.get(name)!;
}
