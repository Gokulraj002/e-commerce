/**
 * BullMQ worker for the INVOICE queue.
 *
 * Job data:   { orderId: string }
 * Job result: { orderId, url }
 *
 * Flow:
 *   1. Load the order code from Prisma.
 *   2. Render the PDF (invoice.ts) and upload it (storage.ts).
 *   3. Idempotently record an AuditLog row (entity=INVOICE, entityId=orderId)
 *      whose `changes.url` points at the persisted PDF.
 *   4. Enqueue an `invoice.ready` notification job with the URL.
 *
 * Kept out of the HTTP process — boot from a dedicated worker entrypoint
 * (e.g. `startInvoiceWorker()` inside a `worker.ts` next to `server.ts`).
 */
import { Worker, type Job } from 'bullmq';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { QUEUES, getQueue, queueConnection } from '../lib/queue.js';
import { generateInvoicePdf } from '../services/invoice.js';
import { uploadPdf } from '../services/storage.js';

export interface InvoiceJobData {
  orderId: string;
}

export interface InvoiceJobResult {
  orderId: string;
  url: string;
}

async function processInvoiceJob(job: Job<InvoiceJobData>): Promise<InvoiceJobResult> {
  const { orderId } = job.data;
  logger.info({ jobId: job.id, orderId }, 'invoice.worker: starting');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, code: true, userId: true },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);

  const pdf = await generateInvoicePdf(order.code);
  const fileName = `invoice-${order.code}.pdf`;
  const url = await uploadPdf(fileName, pdf);

  await recordInvoiceAuditLog(order.id, url);

  await getQueue(QUEUES.NOTIFICATIONS).add('invoice.ready', {
    orderId: order.id,
    orderCode: order.code,
    userId: order.userId,
    url,
  });

  logger.info({ jobId: job.id, orderId, url }, 'invoice.worker: complete');
  return { orderId: order.id, url };
}

/**
 * Emulated upsert on AuditLog (no unique index on entity+entityId in the
 * schema): find-first, then update-or-create. Concurrent duplicate jobs are
 * prevented upstream by using a stable BullMQ `jobId` (see invoice.routes.ts),
 * so a race here is unlikely; if the schema ever gets a `@@unique` on
 * (entity, entityId) this can be swapped for a native `prisma.auditLog.upsert`.
 */
async function recordInvoiceAuditLog(orderId: string, url: string): Promise<void> {
  const existing = await prisma.auditLog.findFirst({
    where: { entity: 'INVOICE', entityId: orderId },
    select: { id: true },
  });
  if (existing) {
    await prisma.auditLog.update({
      where: { id: existing.id },
      data: { action: 'INVOICE_GENERATED', changes: { url } },
    });
    return;
  }
  await prisma.auditLog.create({
    data: {
      action: 'INVOICE_GENERATED',
      entity: 'INVOICE',
      entityId: orderId,
      changes: { url },
    },
  });
}

/**
 * Boot the invoice worker. Call from a dedicated worker process entrypoint
 * (do not call inside the API server — keeps CPU-heavy PDF work off the
 * request path).
 */
export function startInvoiceWorker(): Worker<InvoiceJobData, InvoiceJobResult> {
  const worker = new Worker<InvoiceJobData, InvoiceJobResult>(
    QUEUES.INVOICE,
    processInvoiceJob,
    { connection: queueConnection, concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'invoice.worker: job failed');
  });
  worker.on('completed', (job, result) => {
    logger.debug({ jobId: job.id, url: result.url }, 'invoice.worker: job completed');
  });

  return worker;
}
