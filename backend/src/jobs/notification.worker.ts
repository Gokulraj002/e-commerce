/**
 * Notification worker.
 *
 * Consumes the NOTIFICATIONS queue. The BullMQ job **name** is the event id
 * (e.g. `order.placed`, `order.status_changed`, `system.lowStock`); the job
 * **data** carries the target ids and (for template events) the order status
 * override. Two payload flavours arrive on this queue:
 *
 *  1. **Template events** — data carries `{ orderId, orderCode?, userId?,
 *     status? }`. We load the Order + User, pick a template by event (with
 *     order.status_changed disambiguated by `status`), and dispatch on every
 *     channel the user is reachable on.
 *  2. **Direct events** (`system.*`, e.g. lowStockAlert / dailySalesReport) —
 *     data already includes `{ userId, title, body, channel?, meta? }` from
 *     the emitting scheduler; we skip templating and write the row directly.
 *
 * IN_APP rows are ALWAYS written — that's the durable record customers see
 * in-app even when SMTP/SMS/WhatsApp providers are unreachable. Outbound
 * sends are best-effort: they never throw, only log + move on.
 *
 * Idempotency: BullMQ can redeliver a job on retry. Before dispatching, the
 * worker claims a Redis key `notif:done:<jobId>` (24h TTL, NX) — if the key
 * already existed we treat the job as a redelivery and no-op.
 */
import { Worker, type Job } from 'bullmq';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { QUEUES, queueConnection } from '../lib/queue.js';
import { redis } from '../lib/redis.js';
import { notify } from '../modules/notification/notification.service.js';
import { sendMail } from '../services/mailer.js';
import { sendSms } from '../services/sms.js';
import { orderConfirmedTemplate } from '../services/templates/orderConfirmed.js';
import { orderDeliveredTemplate } from '../services/templates/orderDelivered.js';
import { orderOutForDeliveryTemplate } from '../services/templates/orderOutForDelivery.js';
import { orderPlacedTemplate } from '../services/templates/orderPlaced.js';
import type {
  OrderForTemplate,
  RenderedTemplate,
  TemplateInput,
} from '../services/templates/types.js';
import { sendWhatsApp } from '../services/whatsapp.js';

// ── Job payload shape ─────────────────────────────────────────────

/**
 * Union of every payload observed on QUEUES.NOTIFICATIONS. All fields are
 * optional at the schema level because emitters vary — the handler branches
 * per event to decide which are actually required.
 */
export interface NotificationJobData {
  orderId?: string;
  orderCode?: string;
  userId?: string;
  channel?: string; // when set, ONLY this channel is dispatched (still writes IN_APP)
  status?: string; // used to disambiguate `order.status_changed`
  // Direct-write payload (system.*)
  title?: string;
  body?: string;
  meta?: Record<string, unknown>;
}

/** Concurrency: notification sends are all IO — modest fan-out is safe. */
const WORKER_CONCURRENCY = 5;

/** Idempotency key TTL — long enough to cover any BullMQ retry budget. */
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

type TemplateRenderer = (input: TemplateInput) => RenderedTemplate;

// ── Event routing ──────────────────────────────────────────────────

/**
 * Pick a template for the given event. `order.status_changed` is a fan-in
 * event — we only render for the terminal customer-facing transitions the
 * spec asks for; other statuses (PACKING, READY, PICKED_UP, …) are silent
 * on purpose so we don't spam customers with internal state changes.
 */
function pickTemplate(event: string, status: string | undefined): TemplateRenderer | null {
  switch (event) {
    case 'order.placed':
      return orderPlacedTemplate;
    case 'order.confirmed':
      return orderConfirmedTemplate;
    case 'order.out_for_delivery':
      return orderOutForDeliveryTemplate;
    case 'order.delivered':
      return orderDeliveredTemplate;
    case 'order.status_changed':
      if (status === 'CONFIRMED') return orderConfirmedTemplate;
      if (status === 'OUT_FOR_DELIVERY') return orderOutForDeliveryTemplate;
      if (status === 'DELIVERED') return orderDeliveredTemplate;
      return null;
    default:
      return null;
  }
}

async function loadOrder(orderId: string): Promise<OrderForTemplate | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true },
  });
}

/**
 * Claim the job's idempotency slot. Returns `true` when the slot is fresh
 * (safe to process), `false` when the job has already been handled and
 * should be skipped.
 */
async function claimJob(jobId: string): Promise<boolean> {
  const key = `notif:done:${jobId}`;
  const set = await redis.set(key, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');
  return set === 'OK';
}

// ── Dispatch helpers ───────────────────────────────────────────────

interface DispatchTargets {
  email?: string | null;
  phone?: string | null;
}

/**
 * Fire the rendered template on every channel the user is reachable on.
 * `channelFilter`, when set, narrows to that single channel. IN_APP is
 * written by the caller — this function only handles outbound providers.
 */
async function dispatchOutbound(
  rendered: RenderedTemplate,
  targets: DispatchTargets,
  channelFilter: string | undefined,
): Promise<void> {
  const wantAll = !channelFilter;
  const sends: Promise<void>[] = [];

  if ((wantAll || channelFilter === 'EMAIL') && targets.email) {
    sends.push(
      sendMail({
        to: targets.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    );
  }
  if ((wantAll || channelFilter === 'SMS') && targets.phone) {
    sends.push(sendSms({ to: targets.phone, body: rendered.sms }));
  }
  if ((wantAll || channelFilter === 'WHATSAPP') && targets.phone) {
    sends.push(sendWhatsApp({ to: targets.phone, body: rendered.whatsapp }));
  }

  await Promise.all(sends);
}

// ── Handlers per payload flavour ───────────────────────────────────

/** Template-driven order lifecycle event. */
async function handleTemplateJob(
  event: string,
  data: NotificationJobData,
  jobId: string,
): Promise<void> {
  if (!data.orderId) {
    logger.warn({ event, jobId }, 'notification worker: template event missing orderId — skipping');
    return;
  }

  const renderer = pickTemplate(event, data.status);
  if (!renderer) {
    logger.warn(
      { event, jobId, status: data.status },
      'notification worker: no template for event — skipping',
    );
    return;
  }

  const order = await loadOrder(data.orderId);
  if (!order) {
    logger.warn(
      { event, jobId, orderId: data.orderId },
      'notification worker: order not found — skipping',
    );
    return;
  }

  const rendered = renderer({ order });

  await dispatchOutbound(rendered, { email: order.user.email, phone: order.user.phone }, data.channel);

  await notify({
    userId: order.user.id,
    channel: 'IN_APP',
    title: rendered.subject,
    body: rendered.text,
    meta: {
      jobId,
      event,
      orderId: order.id,
      orderCode: order.code,
      status: order.status,
    },
  });

  logger.info(
    { event, jobId, orderId: order.id, orderCode: order.code, userId: order.user.id },
    'notification dispatched',
  );
}

/**
 * Direct-write payload (schedulers already produced the copy). We only
 * record the IN_APP row here — outbound channels for system events fan out
 * elsewhere when needed.
 */
async function handleDirectJob(
  event: string,
  data: NotificationJobData,
  jobId: string,
): Promise<void> {
  if (!data.userId || !data.title || !data.body) {
    logger.warn(
      { event, jobId, hasUserId: Boolean(data.userId), hasTitle: Boolean(data.title) },
      'notification worker: direct event missing userId/title/body — skipping',
    );
    return;
  }

  await notify({
    userId: data.userId,
    channel: data.channel ?? 'IN_APP',
    title: data.title,
    body: data.body,
    meta: {
      ...(data.meta ?? {}),
      jobId,
      event,
    },
  });

  logger.info({ event, jobId, userId: data.userId }, 'system notification written');
}

// ── Router ─────────────────────────────────────────────────────────

async function handleJob(job: Job<NotificationJobData>): Promise<void> {
  const event = job.name;
  const data = job.data ?? {};
  const jobId = job.id ?? `${event}:${job.timestamp ?? Date.now()}`;

  if (!(await claimJob(jobId))) {
    logger.debug({ event, jobId }, 'notification worker: job already processed — skipping');
    return;
  }

  // Direct payloads carry their own copy (title + body). Everything else
  // must resolve through a template.
  if (data.title && data.body) {
    return handleDirectJob(event, data, jobId);
  }

  const templateRoutes: readonly string[] = [
    'order.placed',
    'order.confirmed',
    'order.out_for_delivery',
    'order.delivered',
    'order.status_changed',
  ];

  if (templateRoutes.includes(event)) {
    return handleTemplateJob(event, data, jobId);
  }

  logger.warn(
    { event, jobId, data },
    'notification worker: unknown event — skipping gracefully',
  );
}

// ── Boot ───────────────────────────────────────────────────────────

/**
 * Start the notification worker. Called from `jobs/index.ts` `startWorkers()`.
 * Returns the Worker so the composition point can wire graceful shutdown.
 */
export function startNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(QUEUES.NOTIFICATIONS, handleJob, {
    connection: queueConnection,
    concurrency: WORKER_CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { err, jobId: job?.id, jobName: job?.name, attemptsMade: job?.attemptsMade },
      'notification worker: job failed',
    );
  });
  worker.on('error', (err) => {
    logger.error({ err }, 'notification worker: transport error');
  });

  logger.info(
    { queue: QUEUES.NOTIFICATIONS, concurrency: WORKER_CONCURRENCY },
    'notification worker started',
  );
  return worker;
}
