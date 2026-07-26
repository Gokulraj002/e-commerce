/**
 * "Order confirmed" template — fires from order.service when a staff member
 * (or the payment webhook) transitions an order to CONFIRMED. Payment is
 * either captured (prepaid) or acknowledged (COD).
 */
import { STORE } from '@elite/shared';

import { firstName, money, wrapHtml, type RenderedTemplate, type TemplateInput } from './types.js';

export function orderConfirmedTemplate({ order }: TemplateInput): RenderedTemplate {
  const name = firstName(order.user);
  const total = money(order.totalPaise);
  const slotLine = order.slotLabel ? ` Slot: ${order.slotLabel}.` : '';

  const subject = `${STORE.NAME}: order ${order.code} confirmed`;

  const text =
    `Hi ${name},\n\n` +
    `Great news — your order ${order.code} is confirmed and heading into our kitchen.\n` +
    `Total: ${total}.` +
    (order.slotLabel ? ` Slot: ${order.slotLabel}.` : '') +
    `\n\nWe'll ping you again once it's out for delivery.`;

  const html = wrapHtml(
    `<h2 style="font-size:18px;margin:0 0 12px">Order confirmed</h2>` +
      `<p style="margin:0 0 8px">Hi ${name}, your order <strong>${order.code}</strong> is confirmed.</p>` +
      `<p style="margin:0 0 8px">Total: <strong>${total}</strong>` +
      (order.slotLabel ? `<br/>Slot: <strong>${order.slotLabel}</strong>` : '') +
      `</p>` +
      `<p style="margin:16px 0 0">We'll message you again once it's out for delivery.</p>`,
  );

  const sms = `${STORE.NAME}: order ${order.code} confirmed. Total ${total}.${slotLine}`;

  const whatsapp =
    `*${STORE.NAME}*\n\n` +
    `Hi ${name}, order *${order.code}* is *confirmed*.\n` +
    `Total: *${total}*` +
    (order.slotLabel ? `\nSlot: *${order.slotLabel}*` : '') +
    `\n\nWe'll ping you when it's out for delivery.`;

  return { subject, html, text, sms, whatsapp };
}
