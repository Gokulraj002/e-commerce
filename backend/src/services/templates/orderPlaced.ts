/**
 * "Order placed" template — fires from checkout.service on successful
 * `placeOrder`. The customer has just committed; this is the receipt.
 */
import { STORE } from '@elite/shared';

import { firstName, money, wrapHtml, type RenderedTemplate, type TemplateInput } from './types.js';

export function orderPlacedTemplate({ order }: TemplateInput): RenderedTemplate {
  const name = firstName(order.user);
  const total = money(order.totalPaise);
  const itemsCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const slotLine = order.slotLabel ? ` Delivery slot: ${order.slotLabel}.` : '';

  const subject = `${STORE.NAME}: order ${order.code} received`;

  const text =
    `Hi ${name},\n\n` +
    `We've received your order ${order.code}.\n` +
    `Items: ${itemsCount} • Total: ${total}\n` +
    `Payment: ${order.paymentMethod} (${order.paymentStatus}).\n` +
    (order.slotLabel ? `Delivery slot: ${order.slotLabel}.\n\n` : '\n') +
    `We'll notify you when it's confirmed. Thanks for choosing ${STORE.NAME}!`;

  const html = wrapHtml(
    `<h2 style="font-size:18px;margin:0 0 12px">Thanks for your order, ${name}!</h2>` +
      `<p style="margin:0 0 8px">We've received order <strong>${order.code}</strong>.</p>` +
      `<p style="margin:0 0 8px">Items: <strong>${itemsCount}</strong><br/>` +
      `Total: <strong>${total}</strong><br/>` +
      `Payment: <strong>${order.paymentMethod}</strong> (${order.paymentStatus})` +
      (order.slotLabel ? `<br/>Delivery slot: <strong>${order.slotLabel}</strong>` : '') +
      `</p>` +
      `<p style="margin:16px 0 0">You'll get another update once it's confirmed.</p>`,
  );

  const sms = `${STORE.NAME}: order ${order.code} received. Total ${total}.${slotLine} Thanks!`;

  const whatsapp =
    `*${STORE.NAME}*\n\n` +
    `Hi ${name}, we've received your order *${order.code}*.\n` +
    `Items: *${itemsCount}*\n` +
    `Total: *${total}*` +
    (order.slotLabel ? `\nDelivery slot: *${order.slotLabel}*` : '') +
    `\n\nWe'll update you once it's confirmed.`;

  return { subject, html, text, sms, whatsapp };
}
