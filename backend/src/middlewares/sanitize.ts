import type { NextFunction, Request, Response } from 'express';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively trim strings and drop empty ones from arbitrary JSON-shaped
 * input. Returns `undefined` for an empty string so callers can filter it out
 * of the containing array/object.
 */
function walk(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const cleaned = walk(item);
      if (cleaned !== undefined) out.push(cleaned);
    }
    return out;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const cleaned = walk(val);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

/**
 * Global body sanitizer. Empty-string fields from HTML forms and half-filled
 * UIs turn into noisy Zod/Prisma failures downstream (`""` fails min-length,
 * confuses optional fields, breaks unique constraints). Stripping them here
 * lets `undefined` semantics propagate cleanly, and trimming saves every route
 * from doing it individually.
 */
export function stripEmpty(req: Request, _res: Response, next: NextFunction): void {
  if (isPlainObject(req.body) || Array.isArray(req.body)) {
    req.body = walk(req.body);
  }
  next();
}
