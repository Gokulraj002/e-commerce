# `backend/src/jobs/` — background workers & scheduled jobs

Everything the Elite NonVeg backend does **outside** the request path lives
here: BullMQ workers that consume queues, and the repeatable schedulers
that push work onto those queues on a cron cadence.

All queues share the single Redis + connection defined in
[`src/lib/queue.ts`](../lib/queue.ts). Do not `new Queue()` ad-hoc —
always go through `getQueue(QUEUES.X)` so the connection pool stays
correct.

## Processes to run in production

The Elite NonVeg backend runs as **two** independent Node processes.
Both are built from the same TypeScript source and read the same `.env`:

| Process   | Command                             | Responsibility                                                          |
| --------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `api`     | `node dist/server.js`               | Express HTTP API. Enqueues jobs but processes none.                     |
| `worker`  | `node dist/jobs/worker.js` *(TBD)* | Runs every BullMQ Worker and registers all repeatable schedules.        |

The API-only process must **never** own the workers — a crashing worker
would take the API down with it, and horizontal scaling of one has
nothing to do with the other. In dev, run both from the repo root in
separate shells (`npm run dev:backend` for the API; add a `dev:worker`
script wired to `tsx watch src/jobs/worker.ts` once the entrypoint
lands).

## Layout

    src/jobs/
    ├── README.md                       ← you are here
    ├── deliveryAssign.scheduler.ts     ← 30s repeatable — enqueue "scan" jobs
    ├── deliveryAssign.worker.ts        ← Worker for the DELIVERY_ASSIGN queue
    └── schedules/                      ← periodic system tasks
        ├── index.ts                    ← registerSchedules() + createScheduleProcessor()
        ├── lowStockAlert.job.ts        ← every 6h — notify admins of low SKUs
        ├── dailySalesReport.job.ts     ← 07:30 daily — enqueue yesterday's digest
        ├── expiredCartSweep.job.ts     ← 03:15 daily — prune cart items > 30 days idle
        └── stockReservationSweep.job.ts ← hourly — cancel stale PENDING_PAYMENT orders

## Scheduled system jobs

Everything under `schedules/` is a **repeatable** — BullMQ emits a job on
its own schedule; a Worker attached to `QUEUES.REPORTS` picks it up and
runs the matching handler.

| Schedule ID                          | Job name                          | Cadence           | Timezone       | Effect                                                                 |
| ------------------------------------ | --------------------------------- | ----------------- | -------------- | ---------------------------------------------------------------------- |
| `schedule:low-stock-alert`           | `schedule.lowStockAlert`          | every 6h (`0 */6 * * *`) | Asia/Kolkata | Notify SUPER_ADMIN / ADMIN of any SKU at/below its reorder level.      |
| `schedule:daily-sales-report`        | `schedule.dailySalesReport`       | daily 07:30 (`30 7 * * *`) | Asia/Kolkata | Yesterday's orders, paid revenue + top 5 products → admin notification. |
| `schedule:expired-cart-sweep`        | `schedule.expiredCartSweep`       | daily 03:15 (`15 3 * * *`) | Asia/Kolkata | Delete every `CartItem` in a `Cart` untouched for > 30 days.           |
| `schedule:stock-reservation-sweep`   | `schedule.stockReservationSweep`  | hourly at :05 (`5 * * * *`) | Asia/Kolkata | Cancel PENDING_PAYMENT orders > 30 min old, release `Inventory.reservedG`. Batches ≤ 100. |

Handlers that need to notify a user (all except the cart sweep) enqueue
a job on `QUEUES.NOTIFICATIONS`; the notification worker (owned by the
notification module) writes the `Notification` row and dispatches the
outbound channel.

### Idempotency

`registerSchedules()` uses BullMQ's `Queue.upsertJobScheduler(id, ...)`,
so the **scheduler id** is the dedupe key. Calling it on every boot
replaces the same schedule in place — no drift, no duplicates.

Renaming or removing a schedule leaves an **orphan** entry in Redis;
drop it manually once:

    await getQueue(QUEUES.REPORTS).removeJobScheduler('schedule:old-id');

## Bootstrapping the `worker` process

The `worker` entrypoint (e.g. `src/jobs/worker.ts` — add when you wire
this up) should:

1. Register every repeatable schedule (idempotent).
2. Start a `Worker` on each queue with its processor.
3. Wire graceful shutdown so in-flight jobs finish on `SIGTERM`.

Example skeleton:

```ts
import { Worker } from 'bullmq';

import { logger } from '../lib/logger.js';
import { QUEUES, queueConnection } from '../lib/queue.js';

import { registerDeliveryAssignScheduler } from './deliveryAssign.scheduler.js';
import { startDeliveryAssignWorker } from './deliveryAssign.worker.js';
import { createScheduleProcessor, registerSchedules } from './schedules/index.js';

async function main(): Promise<void> {
  // 1. Register every repeatable — idempotent, safe on every boot.
  await registerSchedules();
  await registerDeliveryAssignScheduler();

  // 2. Start the workers.
  const workers = [
    new Worker(QUEUES.REPORTS, createScheduleProcessor(), {
      connection: queueConnection,
      concurrency: 2,
    }),
    startDeliveryAssignWorker(),
    // add notification / invoice workers here …
  ];

  // 3. Graceful shutdown.
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'worker: shutting down');
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.info('worker: started');
}

main().catch((err) => {
  logger.error({ err }, 'worker: fatal boot error');
  process.exit(1);
});
```

Only the `worker` process should register schedules and start workers.
Calling `registerSchedules()` from the API process is technically safe
(upsert is idempotent) but muddies ownership — leave the schedules to
the process that actually consumes them.

## Testing a scheduled job locally

Every handler is exported as a plain async function so it can be invoked
directly from a REPL, a test, or a one-off script — no need to wait for
the cron tick:

```ts
import { getQueue, QUEUES } from '../lib/queue.js';
import { runLowStockAlert } from './schedules/lowStockAlert.job.js';

await runLowStockAlert({ notificationsQueue: getQueue(QUEUES.NOTIFICATIONS) });
```
