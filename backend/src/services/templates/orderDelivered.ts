/**
 * "Order delivered" template — fires on the terminal DELIVERED transition.
 * Doubles as the review-nudge: brief, warm, and points at the order code
 * so the user can find it in their history.
 */
import { STORE } from '@elite/shared';

import { firstName, money, wrapHtml, type RenderedTemplate, type TemplateInput } from './types.js';

export function orderDeliveredTemplate({ order }: TemplateInput): RenderedTemplate {
  const name = firstName(order.user);
  const total = money(order.totalPaise);

  const subject = `${STORE.NAME}: order ${order.code} delivered`;

  const text =
    `Hi ${name},\n\n` +
    `Your order ${order.code} has been delivered. Enjoy!\n` +
    `Amount: ${total}.\n\n` +
    `Loved the cuts? A quick review helps us improve every batch.\n` +
    `Thank you for choosing ${STORE.NAME}.`;

  const html = wrapHtml(
    `<h2 style="font-size:18px;margin:0 0 12px">Delivered — enjoy!</h2>` +
      `<p style="margin:0 0 8px">Hi ${name}, order <strong>${order.code}</strong> has been delivered.</p>` +
      `<p style="margin:0 0 8px">Amount: <strong>${total}</strong>.</p>` +
      `<p style="margin:16px 0 0">Loved the cuts? A quick review helps us improve every batch.</p>`,
  );

  const sms = `${STORE.NAME}: order ${order.code} delivered. Enjoy! Amount ${total}.`;

  const whatsapp =
    `*${STORE.NAME}*\n\n` +
    `Hi ${name}, order *${order.code}* has been *delivered*. Enjoy!\n` +
    `Amount: *${total}*.\n\n` +
    `A quick review helps us improve every batch. Thank you!`;

  return { subject, html, text, sms, whatsapp };
}
