import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { logger } from '../lib/logger.js';
import { ApiError } from '../utils/ApiError.js';

/** 404 for unmatched routes. */
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: 'Route not found', code: 'NOT_FOUND' });
}

/** Central error formatter. Keep ALL error shaping here. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json({ success: false, message: err.message, code: err.code, details: err.details });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res
        .status(409)
        .json({ success: false, message: 'Record already exists', code: 'CONFLICT' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Record not found', code: 'NOT_FOUND' });
    }
  }

  logger.error(err);
  return res
    .status(500)
    .json({ success: false, message: 'Internal server error', code: 'INTERNAL' });
}
