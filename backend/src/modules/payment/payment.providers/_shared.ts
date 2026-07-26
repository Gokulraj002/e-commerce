/**
 * Shared low-level helpers for the gateway providers: HMAC/SHA helpers, a
 * constant-time comparison, a guarded fetch, and tiny `unknown`-narrowing
 * accessors so provider code stays `any`-free while reading gateway JSON.
 */
import crypto from 'node:crypto';

import { ApiError } from '../../../utils/ApiError.js';
import type { WebhookHeaders } from '../payment.types.js';

export function hmacSha256Hex(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function hmacSha256Base64(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('base64');
}

export function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** Constant-time string compare — avoids leaking signature bytes via timing. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Case-insensitive single-value header read. */
export function headerValue(headers: WebhookHeaders, name: string): string | undefined {
  const v = headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Fetch wrapper that NEVER throws a raw network error to the caller — gateway
 * failures become a typed `ApiError` the error middleware can format. Providers
 * only call this once credentials are confirmed present.
 */
export async function gatewayFetch<T>(
  url: string,
  init: RequestInit,
  gateway: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw ApiError.badRequest(`${gateway} is unreachable`, { gateway });
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw ApiError.badRequest(`${gateway} request failed (${res.status})`, body);
  }
  return body as T;
}

/** Parse a Buffer body into a JSON object, tolerating malformed input. */
export function toJsonObject(buf: Buffer): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(buf.toString('utf8') || '{}');
    return asRecord(parsed) ?? {};
  } catch {
    return {};
  }
}

export function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined;
}

export function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
