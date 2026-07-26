import type { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlation id assigned by the requestId middleware. */
    id?: string;
  }
}

/**
 * Assign a unique correlation id to every request and echo it back on the
 * `X-Request-Id` response header so logs, error responses, and downstream
 * services can be stitched together end-to-end. Wired early — before pino-http
 * — so the id shows up on every log line.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = nanoid();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
