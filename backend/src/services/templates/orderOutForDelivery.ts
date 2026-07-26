/**
 * "Out for delivery" template — fires when a partner picks the order up
 * and the status flips to OUT_FOR_DELIVERY. This is the "your rider is
 * on the way" nudge; keep it short (SMS is often read from a lock-screen).
 */
import { STORE } from '@elite/shared';

import { firstName, wrapHtml, type RenderedTemplate, type TemplateInput } from './types.js';

export function orderOutForDeliveryTemplate({ order }: TemplateInput): RenderedTemplate {
  const name = firstName(order.user);

  const subject = `${STORE.NAME}: order ${order.code} is out for delivery`;

  const text =
    `Hi ${name},\n\n` +
    `Your order ${order.code} is out for delivery — the rider will be with you shortly.\n` +
    `Please keep your phone reachable to receive the delivery OTP.`;

  const html = wrapHtml(
    `<h2 style="font-size:18px;margin:0 0 12px">On its way!</h2>` +
      `<p style="margin:0 0 8px">Hi ${name}, order <strong>${order.code}</strong> is <strong>out for delivery</strong>.</p>` +
      `<p style="margin:0 0 8px">Please keep your phone reachable — the rider will confirm delivery with an OTP.</p>`,
  );

  const sms = `${STORE.NAME}: order ${order.code} is out for delivery. Keep phone handy for the OTP.`;

  const whatsapp =
    `*${STORE.NAME}*\n\n` +
    `Hi ${name}, your order *${order.code}* is *out for delivery*.\n` +
    `Please keep your phone handy for the delivery OTP.`;

  return { subject, html, text, sms, whatsapp };
}
