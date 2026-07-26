/**
 * Shared template types + tiny formatting helpers.
 *
 * Each template file exports a pure function that takes { order } (Order with
 * its items and user loaded) and returns a `RenderedTemplate` — one payload
 * per outbound channel plus the shared IN_APP text. Templates never touch
 * Prisma, env, or IO — trivial to unit-test.
 */
import type { Order, OrderItem, User } from '@prisma/client';

import { MONEY, STORE } from '@elite/shared';

/** Order loaded with the fields every notification template needs. */
export type OrderForTemplate = Order & {
  items: OrderItem[];
  user: User;
};

/**
 * Rendered copy for a single event, one payload per channel.
 *  - `subject` doubles as the IN_APP row's `title`.
 *  - `text`    is the plain-text email body AND the IN_APP row's `body`.
 */
export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
  sms: string;
  whatsapp: string;
}

export interface TemplateInput {
  order: OrderForTemplate;
}

/** Paise (Int) → "₹123.45" for display only. Money on the wire stays paise. */
export function money(paise: number): string {
  return `${STORE.CURRENCY_SYMBOL}${(paise / MONEY.UNIT_PER_RUPEE).toFixed(2)}`;
}

/** First word of the user's full name, safely trimmed. Falls back to "Customer". */
export function firstName(user: { name: string }): string {
  const fn = user.name.trim().split(/\s+/)[0];
  return fn && fn.length > 0 ? fn : 'Customer';
}

/**
 * Wrap arbitrary inner HTML in a minimal, inline-styled shell so it renders
 * consistently across email clients (Gmail strips <style>, so everything is
 * inline). Kept intentionally tiny — templates own their own body content.
 */
export function wrapHtml(inner: string): string {
  return [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;`,
    `max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.5">`,
    `<div style="font-weight:700;font-size:16px;color:#B32626;margin-bottom:16px">${STORE.NAME}</div>`,
    inner,
    `<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />`,
    `<div style="font-size:12px;color:#888">`,
    `Need help? WhatsApp us at <a href="https://wa.me/${STORE.SUPPORT_WHATSAPP.replace(/[^0-9]/g, '')}" style="color:#B32626">${STORE.SUPPORT_WHATSAPP}</a>.`,
    `</div>`,
    `</div>`,
  ].join('');
}
